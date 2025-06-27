// Background Script for LinkedIn Job Assistant
// Import configuration
importScripts('../utils/config.js');

// Job Analysis Cache System
class JobAnalysisCache {
    constructor() {
        this.cachePrefix = 'jobAnalysisCache_';
        this.maxCacheSize = 100; // Maximum number of cached analyses
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        this.cleanupInterval = 60 * 60 * 1000; // Cleanup every hour

        // Storage quota management
        this.maxStorageUsage = 0.8; // Use at most 80% of available storage
        this.criticalStorageThreshold = 0.9; // Aggressive cleanup at 90%
        this.emergencyCleanupThreshold = 0.95; // Emergency cleanup at 95%

        // Performance tracking
        this.cacheHits = 0;
        this.cacheMisses = 0;
        this.lastAccessTimes = new Map(); // Track access times for LRU

        // Start periodic cleanup
        this.startPeriodicCleanup();

        // Initialize storage monitoring
        this.initStorageMonitoring();
    }

    // Generate cache key for a job
    generateCacheKey(jobData) {
        // Create a unique key based on job content
        const keyData = {
            title: jobData.title || '',
            company: jobData.company || '',
            description: (jobData.description || '').substring(0, 200), // First 200 chars
            url: jobData.url || ''
        };

        // Simple hash function
        const str = JSON.stringify(keyData);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }

        return this.cachePrefix + Math.abs(hash).toString();
    }

    // Store analysis result in cache
    async storeAnalysis(jobData, analysisResult) {
        try {
            const cacheKey = this.generateCacheKey(jobData);
            const cacheEntry = {
                analysis: analysisResult,
                timestamp: Date.now(),
                lastAccessed: Date.now(),
                jobTitle: jobData.title || 'Unknown',
                company: jobData.company || 'Unknown',
                // Optimize storage by only keeping essential analysis data
                size: JSON.stringify(analysisResult).length
            };

            // Check storage usage before storing
            const storageInfo = await this.checkStorageUsage();

            // Attempt to store with error handling
            try {
                await chrome.storage.local.set({ [cacheKey]: cacheEntry });
            } catch (storageError) {
                if (storageError.message && storageError.message.includes('QUOTA_BYTES')) {
                    console.warn('📦 Storage quota exceeded, performing emergency cleanup');
                    await this.emergencyCleanup();

                    // Try again after cleanup
                    try {
                        await chrome.storage.local.set({ [cacheKey]: cacheEntry });
                    } catch (retryError) {
                        console.error('❌ Failed to store after cleanup:', retryError);
                        throw retryError;
                    }
                } else {
                    throw storageError;
                }
            }

            // Update cache index
            await this.updateCacheIndex(cacheKey);

            console.log(`✅ Cached analysis for: ${cacheEntry.jobTitle} at ${cacheEntry.company} (${this.formatBytes(cacheEntry.size)})`);

        } catch (error) {
            console.error('Error storing analysis in cache:', error);
            // Don't throw error to avoid breaking the analysis flow
        }
    }

    // Retrieve analysis from cache
    async getAnalysis(jobData) {
        try {
            const cacheKey = this.generateCacheKey(jobData);
            const result = await chrome.storage.local.get([cacheKey]);
            const cacheEntry = result[cacheKey];

            if (!cacheEntry) {
                this.cacheMisses++;
                return null; // Cache miss
            }

            // Check if cache entry is expired
            const age = Date.now() - cacheEntry.timestamp;
            if (age > this.cacheExpiry) {
                // Remove expired entry
                await chrome.storage.local.remove([cacheKey]);
                await this.removeFromCacheIndex(cacheKey);
                console.log(`🗑️ Removed expired cache entry for: ${cacheEntry.jobTitle}`);
                this.cacheMisses++;
                return null;
            }

            // Update last accessed time for LRU tracking
            const updatedEntry = {
                ...cacheEntry,
                lastAccessed: Date.now()
            };

            try {
                await chrome.storage.local.set({ [cacheKey]: updatedEntry });
            } catch (error) {
                // If we can't update access time, still return the cached result
                console.warn('Could not update access time:', error);
            }

            this.cacheHits++;
            console.log(`🎯 Cache hit for: ${cacheEntry.jobTitle} at ${cacheEntry.company} (${Math.round(age / 1000 / 60)} minutes old)`);
            return cacheEntry.analysis;

        } catch (error) {
            console.error('Error retrieving analysis from cache:', error);
            this.cacheMisses++;
            return null;
        }
    }

    // Update cache index to track all cached items
    async updateCacheIndex(cacheKey) {
        try {
            const result = await chrome.storage.local.get(['cacheIndex']);
            const cacheIndex = result.cacheIndex || [];

            // Add new key if not already present
            if (!cacheIndex.includes(cacheKey)) {
                cacheIndex.push(cacheKey);

                // Enforce cache size limit with LRU eviction
                if (cacheIndex.length > this.maxCacheSize) {
                    const entriesToRemove = cacheIndex.length - this.maxCacheSize;
                    console.log(`📦 Cache size limit reached, removing ${entriesToRemove} oldest entries`);

                    // Sort by access time and remove oldest entries
                    const sortedEntries = await this.sortEntriesByAccessTime(cacheIndex);
                    const keysToRemove = sortedEntries.slice(0, entriesToRemove);

                    await chrome.storage.local.remove(keysToRemove);
                    const updatedIndex = cacheIndex.filter(key => !keysToRemove.includes(key));
                    await chrome.storage.local.set({ cacheIndex: updatedIndex });

                    console.log(`🗑️ Removed ${keysToRemove.length} oldest cache entries to maintain size limit`);
                } else {
                    await chrome.storage.local.set({ cacheIndex });
                }
            }
        } catch (error) {
            console.error('Error updating cache index:', error);

            // If index update fails due to storage issues, try emergency cleanup
            if (error.message && error.message.includes('QUOTA_BYTES')) {
                console.warn('📦 Cache index storage failed, performing emergency cleanup');
                await this.emergencyCleanup();
            }
        }
    }

    // Remove key from cache index
    async removeFromCacheIndex(cacheKey) {
        try {
            const result = await chrome.storage.local.get(['cacheIndex']);
            const cacheIndex = result.cacheIndex || [];
            const updatedIndex = cacheIndex.filter(key => key !== cacheKey);
            await chrome.storage.local.set({ cacheIndex: updatedIndex });
        } catch (error) {
            console.error('Error removing from cache index:', error);
        }
    }

    // Get cache statistics
    async getCacheStats() {
        try {
            const result = await chrome.storage.local.get(['cacheIndex']);
            const cacheIndex = result.cacheIndex || [];

            // Get storage usage information
            const storageInfo = await this.checkStorageUsage();

            // Get all cache entries
            const cacheEntries = await chrome.storage.local.get(cacheIndex);

            let validEntries = 0;
            let expiredEntries = 0;
            let totalSize = 0;
            let oldestEntry = null;
            let newestEntry = null;

            for (const key of cacheIndex) {
                const entry = cacheEntries[key];
                if (entry) {
                    const age = Date.now() - entry.timestamp;
                    const entrySize = JSON.stringify(entry).length;
                    totalSize += entrySize;

                    if (age > this.cacheExpiry) {
                        expiredEntries++;
                    } else {
                        validEntries++;
                    }

                    // Track oldest and newest entries
                    if (!oldestEntry || entry.timestamp < oldestEntry.timestamp) {
                        oldestEntry = entry;
                    }
                    if (!newestEntry || entry.timestamp > newestEntry.timestamp) {
                        newestEntry = entry;
                    }
                }
            }

            // Calculate cache hit rate
            const totalRequests = this.cacheHits + this.cacheMisses;
            const hitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;

            return {
                totalEntries: cacheIndex.length,
                validEntries,
                expiredEntries,
                totalSizeBytes: totalSize,
                totalSizeFormatted: this.formatBytes(totalSize),
                cacheHitRate: Math.round(hitRate * 100) / 100,
                cacheHits: this.cacheHits,
                cacheMisses: this.cacheMisses,
                maxCacheSize: this.maxCacheSize,
                cacheExpiry: this.cacheExpiry,
                storageUsage: storageInfo.usage,
                storageQuota: storageInfo.quota,
                storageUsageRatio: Math.round(storageInfo.usageRatio * 100),
                storageUsageFormatted: this.formatBytes(storageInfo.usage),
                storageQuotaFormatted: this.formatBytes(storageInfo.quota),
                oldestEntry: oldestEntry ? {
                    jobTitle: oldestEntry.jobTitle,
                    company: oldestEntry.company,
                    age: Math.round((Date.now() - oldestEntry.timestamp) / 1000 / 60 / 60) // hours
                } : null,
                newestEntry: newestEntry ? {
                    jobTitle: newestEntry.jobTitle,
                    company: newestEntry.company,
                    age: Math.round((Date.now() - newestEntry.timestamp) / 1000 / 60) // minutes
                } : null
            };
        } catch (error) {
            console.error('Error getting cache stats:', error);
            return {
                totalEntries: 0,
                validEntries: 0,
                expiredEntries: 0,
                totalSizeBytes: 0,
                totalSizeFormatted: '0 Bytes',
                cacheHitRate: 0,
                cacheHits: this.cacheHits,
                cacheMisses: this.cacheMisses,
                storageUsageRatio: 0,
                error: error.message
            };
        }
    }

    // Clear all cache
    async clearCache() {
        try {
            const result = await chrome.storage.local.get(['cacheIndex']);
            const cacheIndex = result.cacheIndex || [];

            // Remove all cache entries
            await chrome.storage.local.remove(cacheIndex);
            await chrome.storage.local.remove(['cacheIndex']);

            // Reset performance counters
            this.cacheHits = 0;
            this.cacheMisses = 0;
            this.lastAccessTimes.clear();

            console.log(`🗑️ Cleared ${cacheIndex.length} cache entries and reset performance counters`);

            return { success: true, clearedEntries: cacheIndex.length };
        } catch (error) {
            console.error('Error clearing cache:', error);
            return { success: false, error: error.message };
        }
    }

    // Periodic cleanup of expired entries
    startPeriodicCleanup() {
        setInterval(async () => {
            await this.performPeriodicMaintenance();
        }, this.cleanupInterval);
    }

    // Perform periodic maintenance including cleanup and storage monitoring
    async performPeriodicMaintenance() {
        try {
            console.log('🧹 Starting periodic cache maintenance...');

            // Check storage usage first
            const storageInfo = await this.checkStorageUsage();

            // Clean up expired entries
            const expiredCleaned = await this.cleanupExpiredEntries();

            // If storage usage is still high after cleaning expired entries, do more aggressive cleanup
            if (storageInfo.usageRatio >= this.maxStorageUsage) {
                console.log('📦 Storage usage still high after expired cleanup, performing additional cleanup');
                await this.proactiveCleanup();
            }

            // Log cache performance metrics
            const stats = await this.getCacheStats();
            console.log(`📊 Cache Stats - Entries: ${stats.validEntries}/${stats.totalEntries}, Hit Rate: ${stats.cacheHitRate}%, Storage: ${stats.storageUsageRatio}%`);

        } catch (error) {
            console.error('Error during periodic maintenance:', error);
        }
    }

    // Clean up expired cache entries
    async cleanupExpiredEntries() {
        try {
            const result = await chrome.storage.local.get(['cacheIndex']);
            const cacheIndex = result.cacheIndex || [];

            if (cacheIndex.length === 0) return;

            const cacheEntries = await chrome.storage.local.get(cacheIndex);
            const expiredKeys = [];

            for (const key of cacheIndex) {
                const entry = cacheEntries[key];
                if (entry) {
                    const age = Date.now() - entry.timestamp;
                    if (age > this.cacheExpiry) {
                        expiredKeys.push(key);
                    }
                }
            }

            if (expiredKeys.length > 0) {
                await chrome.storage.local.remove(expiredKeys);

                // Update cache index
                const updatedIndex = cacheIndex.filter(key => !expiredKeys.includes(key));
                await chrome.storage.local.set({ cacheIndex: updatedIndex });

                console.log(`🧹 Cleaned up ${expiredKeys.length} expired cache entries`);
            }
        } catch (error) {
            console.error('Error during cache cleanup:', error);
        }
    }

    // Initialize storage monitoring
    async initStorageMonitoring() {
        try {
            // Set up storage change listener to monitor usage
            chrome.storage.onChanged.addListener((changes, namespace) => {
                if (namespace === 'local') {
                    this.checkStorageUsage();
                }
            });

            // Initial storage check
            await this.checkStorageUsage();
        } catch (error) {
            console.error('Error initializing storage monitoring:', error);
        }
    }

    // Check current storage usage and cleanup if necessary
    async checkStorageUsage() {
        try {
            const usage = await chrome.storage.local.getBytesInUse();
            const quota = chrome.storage.local.QUOTA_BYTES || 10485760; // Default 10MB if not available
            const usageRatio = usage / quota;

            console.log(`📊 Storage usage: ${this.formatBytes(usage)} / ${this.formatBytes(quota)} (${Math.round(usageRatio * 100)}%)`);

            if (usageRatio >= this.emergencyCleanupThreshold) {
                console.warn('🚨 Emergency storage cleanup - usage at 95%+');
                await this.emergencyCleanup();
            } else if (usageRatio >= this.criticalStorageThreshold) {
                console.warn('⚠️ Critical storage cleanup - usage at 90%+');
                await this.aggressiveCleanup();
            } else if (usageRatio >= this.maxStorageUsage) {
                console.log('🧹 Proactive storage cleanup - usage at 80%+');
                await this.proactiveCleanup();
            }

            return { usage, quota, usageRatio };
        } catch (error) {
            console.error('Error checking storage usage:', error);
            return { usage: 0, quota: 0, usageRatio: 0 };
        }
    }

    // Format bytes for human-readable output
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Emergency cleanup - remove 50% of cache entries
    async emergencyCleanup() {
        try {
            const result = await chrome.storage.local.get(['cacheIndex']);
            const cacheIndex = result.cacheIndex || [];

            if (cacheIndex.length === 0) return;

            // Sort by access time (LRU first) and remove 50%
            const entriesToRemove = Math.ceil(cacheIndex.length * 0.5);
            const sortedEntries = await this.sortEntriesByAccessTime(cacheIndex);
            const keysToRemove = sortedEntries.slice(0, entriesToRemove);

            await chrome.storage.local.remove(keysToRemove);
            const updatedIndex = cacheIndex.filter(key => !keysToRemove.includes(key));
            await chrome.storage.local.set({ cacheIndex: updatedIndex });

            console.log(`🚨 Emergency cleanup: Removed ${keysToRemove.length} cache entries`);
            return keysToRemove.length;
        } catch (error) {
            console.error('Error in emergency cleanup:', error);
            return 0;
        }
    }

    // Aggressive cleanup - remove 30% of cache entries
    async aggressiveCleanup() {
        try {
            const result = await chrome.storage.local.get(['cacheIndex']);
            const cacheIndex = result.cacheIndex || [];

            if (cacheIndex.length === 0) return;

            // Sort by access time (LRU first) and remove 30%
            const entriesToRemove = Math.ceil(cacheIndex.length * 0.3);
            const sortedEntries = await this.sortEntriesByAccessTime(cacheIndex);
            const keysToRemove = sortedEntries.slice(0, entriesToRemove);

            await chrome.storage.local.remove(keysToRemove);
            const updatedIndex = cacheIndex.filter(key => !keysToRemove.includes(key));
            await chrome.storage.local.set({ cacheIndex: updatedIndex });

            console.log(`⚠️ Aggressive cleanup: Removed ${keysToRemove.length} cache entries`);
            return keysToRemove.length;
        } catch (error) {
            console.error('Error in aggressive cleanup:', error);
            return 0;
        }
    }

    // Proactive cleanup - remove expired and 20% of oldest entries
    async proactiveCleanup() {
        try {
            await this.cleanupExpiredEntries();

            const result = await chrome.storage.local.get(['cacheIndex']);
            const cacheIndex = result.cacheIndex || [];

            if (cacheIndex.length === 0) return;

            // Remove 20% of oldest entries
            const entriesToRemove = Math.ceil(cacheIndex.length * 0.2);
            const sortedEntries = await this.sortEntriesByAccessTime(cacheIndex);
            const keysToRemove = sortedEntries.slice(0, entriesToRemove);

            await chrome.storage.local.remove(keysToRemove);
            const updatedIndex = cacheIndex.filter(key => !keysToRemove.includes(key));
            await chrome.storage.local.set({ cacheIndex: updatedIndex });

            console.log(`🧹 Proactive cleanup: Removed ${keysToRemove.length} cache entries`);
            return keysToRemove.length;
        } catch (error) {
            console.error('Error in proactive cleanup:', error);
            return 0;
        }
    }

    // Sort cache entries by access time (LRU first)
    async sortEntriesByAccessTime(cacheIndex) {
        try {
            const cacheEntries = await chrome.storage.local.get(cacheIndex);

            return cacheIndex.sort((a, b) => {
                const aEntry = cacheEntries[a];
                const bEntry = cacheEntries[b];

                // Use lastAccessed if available, otherwise use timestamp
                const aTime = (aEntry && aEntry.lastAccessed) || (aEntry && aEntry.timestamp) || 0;
                const bTime = (bEntry && bEntry.lastAccessed) || (bEntry && bEntry.timestamp) || 0;

                return aTime - bTime; // Oldest first
            });
        } catch (error) {
            console.error('Error sorting entries by access time:', error);
            return cacheIndex;
        }
    }

    // Optimize cache for bulk operations
    async optimizeForBulkAnalysis() {
        try {
            console.log('🚀 Optimizing cache for bulk analysis...');

            // Check storage and perform aggressive cleanup if needed
            const storageInfo = await this.checkStorageUsage();

            if (storageInfo.usageRatio >= 0.7) {
                console.log('📦 Pre-emptive cleanup for bulk analysis');
                await this.aggressiveCleanup();
            }

            // Reduce cache expiry temporarily for bulk operations to save space
            const originalExpiry = this.cacheExpiry;
            this.cacheExpiry = 12 * 60 * 60 * 1000; // 12 hours for bulk operations

            console.log('⚡ Cache optimized for bulk analysis (12-hour expiry)');

            // Reset expiry after 1 hour
            setTimeout(() => {
                this.cacheExpiry = originalExpiry;
                console.log('🔄 Cache expiry reset to 24 hours');
            }, 60 * 60 * 1000);

        } catch (error) {
            console.error('Error optimizing cache for bulk analysis:', error);
        }
    }

    // Batch store multiple analyses (for bulk operations)
    async batchStoreAnalyses(jobDataArray, analysisResults) {
        if (jobDataArray.length !== analysisResults.length) {
            console.error('Mismatch between job data and analysis results arrays');
            return;
        }

        try {
            // Optimize for bulk operation
            await this.optimizeForBulkAnalysis();

            const batchOperations = {};
            const cacheKeys = [];

            for (let i = 0; i < jobDataArray.length; i++) {
                const jobData = jobDataArray[i];
                const analysisResult = analysisResults[i];
                const cacheKey = this.generateCacheKey(jobData);

                const cacheEntry = {
                    analysis: analysisResult,
                    timestamp: Date.now(),
                    lastAccessed: Date.now(),
                    jobTitle: jobData.title || 'Unknown',
                    company: jobData.company || 'Unknown',
                    size: JSON.stringify(analysisResult).length,
                    bulkAnalysis: true // Mark as bulk analysis
                };

                batchOperations[cacheKey] = cacheEntry;
                cacheKeys.push(cacheKey);
            }

            // Store all entries in a single operation
            try {
                await chrome.storage.local.set(batchOperations);
                console.log(`✅ Batch stored ${cacheKeys.length} analyses`);

                // Update cache index for all new entries
                for (const cacheKey of cacheKeys) {
                    await this.updateCacheIndex(cacheKey);
                }

            } catch (storageError) {
                if (storageError.message && storageError.message.includes('QUOTA_BYTES')) {
                    console.warn('📦 Batch storage quota exceeded, storing individually with cleanup');

                    // Fall back to individual storage with cleanup between each
                    for (let i = 0; i < jobDataArray.length; i++) {
                        await this.storeAnalysis(jobDataArray[i], analysisResults[i]);

                        // Check storage every 10 entries during bulk operations
                        if (i % 10 === 0) {
                            await this.checkStorageUsage();
                        }
                    }
                } else {
                    throw storageError;
                }
            }

        } catch (error) {
            console.error('Error in batch store analyses:', error);
        }
    }
}

class BackgroundService {
    constructor() {
        this.API_BASE_URL = Config.getApiBaseUrl();
        this.cache = new JobAnalysisCache(); // Add caching system
        try {
            this.init();
            console.log('LinkedIn Job Assistant background service initialized');
        } catch (error) {
            console.error('Error initializing background service:', error);
        }
    }

    init() {
        try {
            this.setupMessageHandlers();
            this.setupContextMenus();
        } catch (error) {
            console.error('Error in background service initialization:', error);
        }
    }

    // Setup message handlers
    setupMessageHandlers() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            try {
                if (!message || !message.type) {
                    sendResponse({ success: false, error: 'Invalid message format' });
                    return false;
                }

                switch (message.type) {
                    case 'ANALYZE_JOB':
                        this.analyzeJob(message.data)
                            .then(response => sendResponse(response))
                            .catch(error => {
                                console.error('Error in ANALYZE_JOB:', error);
                                sendResponse({ success: false, error: error.message });
                            });
                        return true; // Keep message channel open for async response

                    case 'SEND_EMAIL':
                        this.sendEmail(message.data)
                            .then(response => sendResponse(response))
                            .catch(error => {
                                console.error('Error in SEND_EMAIL:', error);
                                sendResponse({ success: false, error: error.message });
                            });
                        return true;

                    case 'GET_USER_PROFILE':
                        this.getUserProfile()
                            .then(response => sendResponse(response))
                            .catch(error => {
                                console.error('Error in GET_USER_PROFILE:', error);
                                sendResponse({ success: false, error: error.message });
                            });
                        return true;

                    case 'UPDATE_USER_PROFILE':
                        this.updateUserProfile(message.data)
                            .then(response => sendResponse(response))
                            .catch(error => {
                                console.error('Error in UPDATE_USER_PROFILE:', error);
                                sendResponse({ success: false, error: error.message });
                            });
                        return true;

                    case 'PRE_FILTER_JOBS':
                        this.preFilterJobs(message.data)
                            .then(response => sendResponse(response))
                            .catch(error => {
                                console.error('Error in PRE_FILTER_JOBS:', error);
                                sendResponse({ success: false, error: error.message });
                            });
                        return true;

                    case 'GET_CACHE_STATS':
                        this.cache.getCacheStats()
                            .then(stats => sendResponse({ success: true, data: stats }))
                            .catch(error => {
                                console.error('Error in GET_CACHE_STATS:', error);
                                sendResponse({ success: false, error: error.message });
                            });
                        return true;

                    case 'CLEAR_CACHE':
                        this.cache.clearCache()
                            .then(result => sendResponse(result))
                            .catch(error => {
                                console.error('Error in CLEAR_CACHE:', error);
                                sendResponse({ success: false, error: error.message });
                            });
                        return true;

                    case 'OPTIMIZE_CACHE_FOR_BULK':
                        this.cache.optimizeForBulkAnalysis()
                            .then(() => sendResponse({ success: true, message: 'Cache optimized for bulk analysis' }))
                            .catch(error => {
                                console.error('Error in OPTIMIZE_CACHE_FOR_BULK:', error);
                                sendResponse({ success: false, error: error.message });
                            });
                        return true;

                    case 'GET_STORAGE_INFO':
                        this.cache.checkStorageUsage()
                            .then(storageInfo => sendResponse({ success: true, data: storageInfo }))
                            .catch(error => {
                                console.error('Error in GET_STORAGE_INFO:', error);
                                sendResponse({ success: false, error: error.message });
                            });
                        return true;

                    case 'FORCE_CACHE_CLEANUP':
                        this.cache.aggressiveCleanup()
                            .then(removedCount => sendResponse({
                                success: true,
                                message: `Removed ${removedCount} cache entries`,
                                removedEntries: removedCount
                            }))
                            .catch(error => {
                                console.error('Error in FORCE_CACHE_CLEANUP:', error);
                                sendResponse({ success: false, error: error.message });
                            });
                        return true;

                    default:
                        sendResponse({ success: false, error: 'Unknown message type: ' + message.type });
                        return false;
                }
            } catch (error) {
                console.error('Error in message handler:', error);
                sendResponse({ success: false, error: 'Message handler error: ' + error.message });
                return false;
            }
        });
    }

    // Setup context menus
    setupContextMenus() {
        // Check if contextMenus API is available
        if (!chrome.contextMenus) {
            console.warn('contextMenus API not available. Please add "contextMenus" permission to manifest.json');
            return;
        }

        chrome.runtime.onInstalled.addListener(() => {
            try {
                chrome.contextMenus.create({
                    id: 'analyze-job-post',
                    title: 'Analyze Job Post with AI',
                    contexts: ['page'],
                    documentUrlPatterns: ['https://www.linkedin.com/*']
                });
                console.log('Context menu created successfully');
            } catch (error) {
                console.error('Error creating context menu:', error);
            }
        });

        chrome.contextMenus.onClicked.addListener((info, tab) => {
            try {
                if (info.menuItemId === 'analyze-job-post') {
                    chrome.tabs.sendMessage(tab.id, { type: 'ANALYZE_TRIGGERED' });
                }
            } catch (error) {
                console.error('Error handling context menu click:', error);
            }
        });
    }

    // Analyze job post using AI backend
    async analyzeJob(jobData) {
        try {
            // Check cache first
            const cachedResult = await this.cache.getAnalysis(jobData);
            if (cachedResult) {
                console.log('🎯 Using cached analysis result');
                return { success: true, data: cachedResult };
            }

            // Cache miss - perform analysis
            console.log('🔍 Cache miss - performing new analysis');

            const response = await fetch(`${this.API_BASE_URL}/api/analyze-job`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    job_data: jobData,
                    user_profile: await this.getUserProfileData()
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            // Store successful result in cache
            await this.cache.storeAnalysis(jobData, result);

            return { success: true, data: result };

        } catch (error) {
            console.error('Error analyzing job:', error);

            // Fallback response if backend is unavailable
            const fallbackResult = this.generateFallbackAnalysis(jobData);

            // Don't cache fallback results as they're less reliable
            console.log('⚠️ Using fallback analysis (not cached)');

            return {
                success: true,
                data: fallbackResult
            };
        }
    }

    // Send email through backend
    async sendEmail(emailData) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/send-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(emailData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return { success: true, data: result };

        } catch (error) {
            console.error('Error sending email:', error);
            return { success: false, error: error.message };
        }
    }

    // Get user profile from storage
    async getUserProfile() {
        try {
            const result = await chrome.storage.sync.get(['userProfile']);
            return {
                success: true,
                data: result.userProfile || this.getDefaultUserProfile()
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get user profile data for API calls
    async getUserProfileData() {
        const profileResponse = await this.getUserProfile();
        return profileResponse.success ? profileResponse.data : this.getDefaultUserProfile();
    }

    // Update user profile in storage
    async updateUserProfile(profileData) {
        try {
            await chrome.storage.sync.set({ userProfile: profileData });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Default user profile
    getDefaultUserProfile() {
        return {
            name: 'Heet Dedakiya',
            experience: 1,
            domain: 'Python Backend Development + AI/ML',
            skills: ['Python', 'Flask', 'FastAPI', 'TensorFlow', 'HuggingFace', 'OpenAI API', 'Pandas', 'NumPy'],
            preferredRoles: ['Backend Developer', 'AI/ML Engineer'],
            preferredWorkType: ['Remote', 'Hybrid', 'On-site in Ahmedabad, Pune, Bengaluru'],
            excludedRoles: ['Frontend', 'Sales', 'DevOps', '.NET', 'PHP-only', 'Android-only'],
            preferredCompanyTypes: ['Tech startups', 'AI-focused firms', 'product-based companies'],
            email: 'heet.dedakiya@example.com',
            phone: '+91-XXXXXXXXXX',
            resumeUrl: ''
        };
    }

    // Pre-filter jobs using AI to determine relevance quickly
    async preFilterJobs(data) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/pre-filter-jobs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jobs: data.jobs,
                    user_profile: await this.getUserProfileData()
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            return { success: true, data: result };

        } catch (error) {
            console.error('Error pre-filtering jobs:', error);

            // Fallback: use simple keyword-based filtering
            return {
                success: true,
                data: this.fallbackPreFilter(data.jobs)
            };
        }
    }

    // Fallback pre-filtering using simple keyword matching
    fallbackPreFilter(jobs) {
        const userProfile = this.getDefaultUserProfile();

        // Fix: Handle skills array properly
        const userSkills = Array.isArray(userProfile.skills)
            ? userProfile.skills.map(skill => skill.toLowerCase())
            : [];

        const userExperience = typeof userProfile.experience === 'string'
            ? userProfile.experience.toLowerCase()
            : String(userProfile.experience || '').toLowerCase();

        const excludedRoles = Array.isArray(userProfile.excludedRoles)
            ? userProfile.excludedRoles.map(role => role.toLowerCase())
            : [];

        const filteredJobs = jobs.filter(job => {
            const jobContent = `${job.title || ''} ${job.company || ''} ${job.description || ''} ${job.content || ''}`.toLowerCase();

            // Basic relevance scoring
            let score = 0;

            // Technical keywords
            const techKeywords = ['developer', 'engineer', 'python', 'javascript', 'api', 'backend', 'frontend', 'ml', 'ai', 'software', 'programmer', 'data'];
            techKeywords.forEach(keyword => {
                if (jobContent.includes(keyword)) score += 1;
            });

            // User skills matching (higher weight)
            userSkills.forEach(skill => {
                if (skill && jobContent.includes(skill)) score += 3;
            });

            // Experience level matching
            if (userExperience && jobContent.includes(userExperience)) {
                score += 1;
            }

            // Check for excluded roles (negative score)
            let hasExcludedRole = false;
            excludedRoles.forEach(excludedRole => {
                if (excludedRole && jobContent.includes(excludedRole)) {
                    hasExcludedRole = true;
                    score -= 5; // Heavy penalty for excluded roles
                }
            });

            // Filter out jobs with score < 2 or has excluded roles
            return score >= 2 && !hasExcludedRole;
        });

        console.log(`Pre-filtered ${jobs.length} jobs to ${filteredJobs.length} potentially relevant jobs`);

        return {
            filteredJobs: filteredJobs,
            originalCount: jobs.length,
            filteredCount: filteredJobs.length
        };
    }

    // Fallback analysis when backend is unavailable
    generateFallbackAnalysis(jobData) {
        const profile = this.getDefaultUserProfile();

        // Simple keyword matching for relevance
        const content = (jobData.title + ' ' + jobData.description + ' ' + jobData.content).toLowerCase();
        const relevantKeywords = ['python', 'flask', 'fastapi', 'ai', 'ml', 'machine learning', 'backend', 'api'];
        const excludedKeywords = ['frontend', 'react', 'angular', 'sales', 'devops', '.net', 'php'];

        const hasRelevantKeywords = relevantKeywords.some(keyword => content.includes(keyword));
        const hasExcludedKeywords = excludedKeywords.some(keyword => content.includes(keyword));

        const isRelevant = hasRelevantKeywords && !hasExcludedKeywords;

        if (!isRelevant) {
            return {
                status: 'NOT RELEVANT',
                reason: 'Job does not match your Python Backend/AI-ML profile or contains excluded technologies',
                contact: null,
                email_subject: '',
                email_body: '',
                attachment_required: false
            };
        }

        // Extract contact email
        const contactEmail = jobData.contactInfo?.emails?.[0] || null;

        const emailSubject = `Application for ${jobData.title || 'Developer Position'}`;
        const emailBody = `Dear Hiring Team,

I came across your job posting for ${jobData.title || 'the developer position'} and I'm excited to apply. As a Python Backend Developer and AI/ML Engineer with ${profile.experience} year of industry experience, I believe I would be a great fit for this role.

My technical expertise includes:
• Backend development using Python, Flask, and FastAPI
• AI/ML model development with TensorFlow and HuggingFace
• API development and integration

I'm passionate about building scalable backend systems and implementing cutting-edge AI solutions. I would love the opportunity to contribute to your team and help drive innovation.

Please find my resume attached for your review. I look forward to hearing from you.

Best regards,
${profile.name}
${profile.email}
${profile.phone}`;

        return {
            status: 'RELEVANT',
            reason: 'Job matches your Python Backend/AI-ML profile with relevant technologies',
            contact: contactEmail,
            email_subject: emailSubject,
            email_body: emailBody,
            attachment_required: true
        };
    }
}

// Initialize background service
try {
    const backgroundService = new BackgroundService();
} catch (error) {
    console.error('Failed to initialize LinkedIn Job Assistant background service:', error);
}