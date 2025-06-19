// Background Script for LinkedIn Job Assistant
class BackgroundService {
    constructor() {
        this.API_BASE_URL = 'http://localhost:5000/api';
        this.init();
    }

    init() {
        this.setupMessageHandlers();
        this.setupContextMenus();
    }

    // Setup message handlers
    setupMessageHandlers() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.type) {
                case 'ANALYZE_JOB':
                    this.analyzeJob(message.data)
                        .then(response => sendResponse(response))
                        .catch(error => sendResponse({ success: false, error: error.message }));
                    return true; // Keep message channel open for async response

                case 'SEND_EMAIL':
                    this.sendEmail(message.data)
                        .then(response => sendResponse(response))
                        .catch(error => sendResponse({ success: false, error: error.message }));
                    return true;

                case 'GET_USER_PROFILE':
                    this.getUserProfile()
                        .then(response => sendResponse(response))
                        .catch(error => sendResponse({ success: false, error: error.message }));
                    return true;

                case 'UPDATE_USER_PROFILE':
                    this.updateUserProfile(message.data)
                        .then(response => sendResponse(response))
                        .catch(error => sendResponse({ success: false, error: error.message }));
                    return true;
            }
        });
    }

    // Setup context menus
    setupContextMenus() {
        chrome.runtime.onInstalled.addListener(() => {
            chrome.contextMenus.create({
                id: 'analyze-job-post',
                title: 'Analyze Job Post with AI',
                contexts: ['page'],
                documentUrlPatterns: ['https://www.linkedin.com/*']
            });
        });

        chrome.contextMenus.onClicked.addListener((info, tab) => {
            if (info.menuItemId === 'analyze-job-post') {
                chrome.tabs.sendMessage(tab.id, { type: 'ANALYZE_TRIGGERED' });
            }
        });
    }

    // Analyze job post using AI backend
    async analyzeJob(jobData) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/analyze-job`, {
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
            return { success: true, data: result };

        } catch (error) {
            console.error('Error analyzing job:', error);

            // Fallback response if backend is unavailable
            return {
                success: true,
                data: this.generateFallbackAnalysis(jobData)
            };
        }
    }

    // Send email through backend
    async sendEmail(emailData) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/send-email`, {
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
const backgroundService = new BackgroundService();