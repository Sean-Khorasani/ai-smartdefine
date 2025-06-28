// src/background/learning-engine.js
// Background Learning Engine - Spaced Repetition & Flashcard Algorithms

class LearningEngine {
  constructor() {
    this.algorithms = {
      spacedRepetition: new SpacedRepetitionEngine(),
      difficultyManager: new DifficultyManager(),
      reviewScheduler: new ReviewScheduler(),
      performanceTracker: new PerformanceTracker()
    };
  }

  // Process word review result and update scheduling
  async processReview(wordData, reviewResult) {
    const { isCorrect, responseTime, confidenceLevel, reviewType } = reviewResult;
    
    // Update performance metrics
    const performance = this.algorithms.performanceTracker.recordReview(
      wordData, isCorrect, responseTime, confidenceLevel
    );
    
    // Calculate new difficulty and ease factor
    const newDifficulty = this.algorithms.difficultyManager.updateDifficulty(
      wordData, performance
    );
    
    // Calculate next review date using spaced repetition
    const nextReview = this.algorithms.spacedRepetition.calculateNextReview(
      wordData, performance, newDifficulty
    );
    
    // Update word data
    const updatedWordData = {
      ...wordData,
      reviewCount: wordData.reviewCount + 1,
      lastReviewed: new Date().toISOString(),
      difficulty: newDifficulty.level,
      easeFactor: newDifficulty.easeFactor,
      interval: nextReview.interval,
      nextReview: nextReview.date,
      performanceHistory: performance.history,
      streak: performance.streak,
      averageResponseTime: performance.averageResponseTime,
      confidenceScore: performance.confidenceScore
    };
    
    return updatedWordData;
  }

  // Get words due for review
  async getWordsForReview(wordLists, reviewType = 'all', limit = 20) {
    const now = new Date();
    const dueWords = [];
    
    Object.keys(wordLists).forEach(category => {
      wordLists[category].forEach(word => {
        const nextReviewDate = new Date(word.nextReview);
        const isDue = nextReviewDate <= now;
        
        if (isDue && this.shouldIncludeInReview(word, reviewType)) {
          dueWords.push({
            ...word,
            category,
            priority: this.calculateReviewPriority(word, now)
          });
        }
      });
    });
    
    // Sort by priority (overdue words first, then by difficulty)
    dueWords.sort((a, b) => b.priority - a.priority);
    
    return dueWords.slice(0, limit);
  }

  // Check if word should be included in review based on type
  shouldIncludeInReview(word, reviewType) {
    switch (reviewType) {
      case 'new':
        return word.difficulty === 'new';
      case 'learning':
        return word.difficulty === 'learning';
      case 'review':
        return word.difficulty === 'mastered';
      case 'difficult':
        return word.easeFactor < 2.0;
      case 'all':
      default:
        return true;
    }
  }

  // Calculate review priority (higher = more urgent)
  calculateReviewPriority(word, now) {
    const nextReviewDate = new Date(word.nextReview);
    const overdueDays = Math.max(0, (now - nextReviewDate) / (1000 * 60 * 60 * 24));
    
    let priority = 0;
    
    // Overdue penalty
    priority += overdueDays * 10;
    
    // Difficulty priority (harder words get higher priority)
    switch (word.difficulty) {
      case 'new':
        priority += 100;
        break;
      case 'learning':
        priority += 50;
        break;
      case 'mastered':
        priority += 10;
        break;
    }
    
    // Low ease factor priority (struggling words)
    if (word.easeFactor < 2.0) {
      priority += 25;
    }
    
    return priority;
  }

  // Generate personalized study recommendations
  async generateStudyRecommendations(wordLists, userSettings) {
    const stats = this.algorithms.performanceTracker.getStudyStats(wordLists);
    const recommendations = [];

    // Check daily goal progress
    const dailyGoal = userSettings.dailyGoal || 10;
    const todayReviews = stats.todayReviews;
    
    if (todayReviews < dailyGoal) {
      recommendations.push({
        type: 'daily_goal',
        priority: 'high',
        message: `Complete ${dailyGoal - todayReviews} more reviews to reach your daily goal!`,
        action: 'review',
        count: dailyGoal - todayReviews
      });
    }

    // Check for overdue words
    if (stats.overdueWords > 0) {
      recommendations.push({
        type: 'overdue',
        priority: 'high',
        message: `You have ${stats.overdueWords} overdue words that need review.`,
        action: 'review_overdue',
        count: stats.overdueWords
      });
    }

    // Check for new words
    if (stats.newWords > 0) {
      recommendations.push({
        type: 'new_words',
        priority: 'medium',
        message: `Start learning ${Math.min(5, stats.newWords)} new words.`,
        action: 'learn_new',
        count: Math.min(5, stats.newWords)
      });
    }

    // Check learning streak
    if (stats.currentStreak > 0) {
      recommendations.push({
        type: 'streak',
        priority: 'low',
        message: `Great job! You're on a ${stats.currentStreak}-day learning streak!`,
        action: 'continue_streak'
      });
    }

    return recommendations;
  }
}

// Spaced Repetition Engine (SM-2 Algorithm)
class SpacedRepetitionEngine {
  calculateNextReview(wordData, performance, difficulty) {
    const easeFactor = difficulty.easeFactor;
    const interval = wordData.interval || 0;
    const isCorrect = performance.lastReviewCorrect;
    
    let newInterval;
    
    if (isCorrect) {
      if (interval === 0) {
        newInterval = 1; // First review: 1 day
      } else if (interval === 1) {
        newInterval = 6; // Second review: 6 days
      } else {
        newInterval = Math.round(interval * easeFactor);
      }
    } else {
      newInterval = 1; // Reset interval for incorrect answers
    }
    
    // Cap interval at maximum
    newInterval = Math.min(newInterval, 365); // Max 1 year
    
    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);
    
    return {
      interval: newInterval,
      date: nextReviewDate.toISOString()
    };
  }
}

// Difficulty Management System
class DifficultyManager {
  updateDifficulty(wordData, performance) {
    const currentEase = wordData.easeFactor || 2.5;
    const reviewCount = wordData.reviewCount || 0;
    const confidenceScore = performance.confidenceScore;
    const isCorrect = performance.lastReviewCorrect;
    
    let newEaseFactor = currentEase;
    let newDifficultyLevel = wordData.difficulty || 'new';
    
    if (isCorrect) {
      // Increase ease factor for correct answers
      newEaseFactor = Math.min(currentEase + 0.1, 3.0);
      
      // Progress difficulty level
      if (newDifficultyLevel === 'new' && reviewCount >= 2) {
        newDifficultyLevel = 'learning';
      } else if (newDifficultyLevel === 'learning' && reviewCount >= 5 && newEaseFactor >= 2.5) {
        newDifficultyLevel = 'mastered';
      }
    } else {
      // Decrease ease factor for incorrect answers
      newEaseFactor = Math.max(currentEase - 0.2, 1.3);
      
      // Regress difficulty if struggling
      if (newDifficultyLevel === 'mastered' && newEaseFactor < 2.0) {
        newDifficultyLevel = 'learning';
      }
    }
    
    // Adjust based on confidence score
    if (confidenceScore < 0.5) {
      newEaseFactor = Math.max(newEaseFactor - 0.1, 1.3);
    } else if (confidenceScore > 0.8) {
      newEaseFactor = Math.min(newEaseFactor + 0.05, 3.0);
    }
    
    return {
      level: newDifficultyLevel,
      easeFactor: Math.round(newEaseFactor * 100) / 100 // Round to 2 decimals
    };
  }
}

// Review Scheduling System
class ReviewScheduler {
  async scheduleBackgroundReviews() {
    // Schedule daily review reminders
    browser.alarms.create('dailyReviewReminder', {
      when: this.getNextReminderTime(),
      periodInMinutes: 24 * 60 // Daily
    });
    
    // Schedule overdue check
    browser.alarms.create('overdueCheck', {
      delayInMinutes: 60, // Check every hour
      periodInMinutes: 60
    });
  }
  
  getNextReminderTime() {
    const now = new Date();
    const reminderTime = new Date();
    reminderTime.setHours(19, 0, 0, 0); // 7 PM
    
    if (now > reminderTime) {
      reminderTime.setDate(reminderTime.getDate() + 1);
    }
    
    return reminderTime.getTime();
  }
  
  async handleAlarm(alarmName) {
    switch (alarmName) {
      case 'dailyReviewReminder':
        await this.sendReviewReminder();
        break;
      case 'overdueCheck':
        await this.checkOverdueWords();
        break;
    }
  }
  
  async sendReviewReminder() {
    const storage = await browser.storage.local.get(['wordLists', 'learningSettings']);
    const settings = storage.learningSettings || {};
    
    if (!settings.reviewReminders) return;
    
    const engine = new LearningEngine();
    const dueWords = await engine.getWordsForReview(storage.wordLists || {});
    
    if (dueWords.length > 0) {
      browser.notifications.create({
        type: 'basic',
        iconUrl: browser.runtime.getURL('icons/icon-48.png'),
        title: 'SmartDefine - Review Time!',
        message: `You have ${dueWords.length} words ready for review. Keep your learning streak going!`
      });
    }
  }
  
  async checkOverdueWords() {
    const storage = await browser.storage.local.get(['wordLists']);
    const wordLists = storage.wordLists || {};
    
    let overdueCount = 0;
    const now = new Date();
    
    Object.values(wordLists).forEach(category => {
      category.forEach(word => {
        const nextReviewDate = new Date(word.nextReview);
        if (nextReviewDate < now) {
          overdueCount++;
        }
      });
    });
    
    // Badge count for overdue words
    if (overdueCount > 0) {
      browser.browserAction.setBadgeText({ text: overdueCount.toString() });
      browser.browserAction.setBadgeBackgroundColor({ color: '#FF5722' });
    } else {
      browser.browserAction.setBadgeText({ text: '' });
    }
  }
}

// Performance Tracking System
class PerformanceTracker {
  recordReview(wordData, isCorrect, responseTime, confidenceLevel) {
    const history = wordData.performanceHistory || [];
    const newRecord = {
      date: new Date().toISOString(),
      correct: isCorrect,
      responseTime: responseTime,
      confidence: confidenceLevel
    };
    
    history.push(newRecord);
    
    // Keep only last 20 reviews
    const recentHistory = history.slice(-20);
    
    // Calculate metrics
    const correctCount = recentHistory.filter(r => r.correct).length;
    const accuracyRate = recentHistory.length > 0 ? correctCount / recentHistory.length : 0;
    
    const avgResponseTime = recentHistory.reduce((sum, r) => sum + r.responseTime, 0) / recentHistory.length;
    const avgConfidence = recentHistory.reduce((sum, r) => sum + r.confidence, 0) / recentHistory.length;
    
    // Calculate streak
    let currentStreak = 0;
    for (let i = recentHistory.length - 1; i >= 0; i--) {
      if (recentHistory[i].correct) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    return {
      history: recentHistory,
      accuracyRate: Math.round(accuracyRate * 100) / 100,
      averageResponseTime: Math.round(avgResponseTime),
      confidenceScore: Math.round(avgConfidence * 100) / 100,
      streak: currentStreak,
      lastReviewCorrect: isCorrect
    };
  }
  
  getStudyStats(wordLists) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let totalWords = 0;
    let newWords = 0;
    let learningWords = 0;
    let masteredWords = 0;
    let overdueWords = 0;
    let todayReviews = 0;
    
    Object.values(wordLists).forEach(category => {
      category.forEach(word => {
        totalWords++;
        
        // Count by difficulty
        switch (word.difficulty) {
          case 'new':
            newWords++;
            break;
          case 'learning':
            learningWords++;
            break;
          case 'mastered':
            masteredWords++;
            break;
        }
        
        // Count overdue
        const nextReviewDate = new Date(word.nextReview);
        if (nextReviewDate < now) {
          overdueWords++;
        }
        
        // Count today's reviews
        if (word.lastReviewed) {
          const lastReviewDate = new Date(word.lastReviewed);
          if (lastReviewDate >= today) {
            todayReviews++;
          }
        }
      });
    });
    
    return {
      totalWords,
      newWords,
      learningWords,
      masteredWords,
      overdueWords,
      todayReviews,
      currentStreak: this.calculateOverallStreak(wordLists)
    };
  }
  
  calculateOverallStreak(wordLists) {
    // Calculate consecutive days of review activity
    const reviewDates = [];
    
    Object.values(wordLists).forEach(category => {
      category.forEach(word => {
        if (word.lastReviewed) {
          const date = new Date(word.lastReviewed).toDateString();
          if (!reviewDates.includes(date)) {
            reviewDates.push(date);
          }
        }
      });
    });
    
    reviewDates.sort((a, b) => new Date(b) - new Date(a));
    
    let streak = 0;
    const today = new Date().toDateString();
    
    if (reviewDates.includes(today)) {
      streak = 1;
      
      for (let i = 1; i < reviewDates.length; i++) {
        const currentDate = new Date(reviewDates[i-1]);
        const previousDate = new Date(reviewDates[i]);
        const diffDays = (currentDate - previousDate) / (1000 * 60 * 60 * 24);
        
        if (diffDays === 1) {
          streak++;
        } else {
          break;
        }
      }
    }
    
    return streak;
  }
}

// Export the learning engine
if (typeof module !== 'undefined') {
  module.exports = { LearningEngine };
} else {
  // Browser environment
  window.LearningEngine = LearningEngine;
}