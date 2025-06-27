// LinkedIn Job Post Parser
class LinkedInParser {
    constructor() {
        this.jobPostSelectors = {
            title: '.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title, h1',
            company: '.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name, .job-details-jobs-unified-top-card__primary-description-container a',
            location: '.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet',
            description: '.job-details-jobs-unified-top-card__job-description, .jobs-description-content__text, .job-view-layout .jobs-description-content',
            postContent: '.feed-shared-update-v2__description, .update-components-text, .feed-shared-text',
            contactInfo: 'a[href*="mailto:"], .contact-info, .application-email'
        };
    }

    // Parse job post from LinkedIn job page
    parseJobPage() {
        try {
            const jobData = {
                type: 'job_page',
                title: this.extractText(this.jobPostSelectors.title),
                company: this.extractText(this.jobPostSelectors.company),
                location: this.extractText(this.jobPostSelectors.location),
                description: this.extractText(this.jobPostSelectors.description),
                contactInfo: this.extractContactInfo(),
                url: window.location.href,
                timestamp: new Date().toISOString()
            };

            return this.cleanJobData(jobData);
        } catch (error) {
            console.error('Error parsing job page:', error);
            return null;
        }
    }

    // Parse job post from LinkedIn feed
    parseFeedPost(postElement = null) {
        try {
            const element = postElement || document;
            const postContent = this.extractText(this.jobPostSelectors.postContent, element);

            const jobData = {
                type: 'feed_post',
                content: postContent,
                contactInfo: this.extractContactInfo(element),
                url: window.location.href,
                timestamp: new Date().toISOString()
            };

            return this.cleanJobData(jobData);
        } catch (error) {
            console.error('Error parsing feed post:', error);
            return null;
        }
    }

    // Extract text from selectors
    extractText(selectors, container = document) {
        const selectorList = selectors.split(', ');

        for (const selector of selectorList) {
            const element = container.querySelector(selector);
            if (element) {
                return element.textContent.trim();
            }
        }

        return '';
    }

    // Extract contact information (emails, names)
    extractContactInfo(container = document) {
        const contacts = {
            emails: [],
            names: [],
            links: []
        };

        // Find email addresses in text
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const bodyText = container.textContent || '';
        const emails = bodyText.match(emailRegex) || [];
        contacts.emails = [...new Set(emails)];

        // Find mailto links
        const mailtoLinks = container.querySelectorAll('a[href^="mailto:"]');
        mailtoLinks.forEach(link => {
            const email = link.href.replace('mailto:', '');
            if (email && !contacts.emails.includes(email)) {
                contacts.emails.push(email);
            }
        });

        // Extract potential recruiter names
        const namePatterns = [
            /reach out to ([A-Z][a-z]+ [A-Z][a-z]+)/gi,
            /contact ([A-Z][a-z]+ [A-Z][a-z]+)/gi,
            /send your resume to ([A-Z][a-z]+ [A-Z][a-z]+)/gi
        ];

        namePatterns.forEach(pattern => {
            const matches = bodyText.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const name = match.replace(/reach out to |contact |send your resume to /gi, '');
                    if (!contacts.names.includes(name)) {
                        contacts.names.push(name);
                    }
                });
            }
        });

        return contacts;
    }

    // Clean and validate job data
    cleanJobData(jobData) {
        // Remove extra whitespace and newlines
        Object.keys(jobData).forEach(key => {
            if (typeof jobData[key] === 'string') {
                jobData[key] = jobData[key].replace(/\s+/g, ' ').trim();
            }
        });

        // Validate required fields
        if (jobData.type === 'job_page') {
            jobData.isValid = !!(jobData.title && jobData.company);
        } else if (jobData.type === 'feed_post') {
            jobData.isValid = !!(jobData.content && jobData.content.length > 50);
        }

        return jobData;
    }

    // Detect if current page is a job posting
    isJobPage() {
        return window.location.href.includes('/jobs/view/') ||
            window.location.href.includes('/jobs/collections/') ||
            document.querySelector('.job-details-jobs-unified-top-card__job-title') !== null;
    }

    // Auto-detect and parse current page
    autoDetectAndParse() {
        if (this.isJobPage()) {
            return this.parseJobPage();
        } else {
            // Check if there are job posts in the feed
            const feedPosts = document.querySelectorAll('.feed-shared-update-v2');
            if (feedPosts.length > 0) {
                // Return the first job-related post found
                for (const post of feedPosts) {
                    const postData = this.parseFeedPost(post);
                    if (postData && this.containsJobKeywords(postData.content)) {
                        return postData;
                    }
                }
            }
        }
        return null;
    }

    // Check if content contains job-related keywords
    containsJobKeywords(content) {
        const jobKeywords = [
            // Direct hiring terms
            'hiring', 'recruiting', 'looking for', 'seeking', 'we are hiring',
            'join our team', 'now hiring', 'open position', 'job opening',

            // Job types
            'job', 'position', 'role', 'opportunity', 'career', 'vacancy',
            'employment', 'work with us', 'team member',

            // Tech roles
            'developer', 'engineer', 'programmer', 'analyst', 'manager',
            'specialist', 'coordinator', 'designer', 'architect', 'consultant',
            'intern', 'graduate', 'senior', 'junior', 'lead', 'principal',

            // Tech skills
            'python', 'java', 'javascript', 'react', 'node', 'backend', 'frontend',
            'fullstack', 'full-stack', 'ml', 'ai', 'machine learning', 'data science',
            'devops', 'cloud', 'aws', 'docker', 'kubernetes',

            // Application terms
            'apply', 'resume', 'cv', 'candidate', 'applicant', 'interview',
            'send your resume', 'submit application', 'interested candidates',

            // Company terms
            'team', 'company', 'startup', 'organization', 'department'
        ];

        const lowerContent = content.toLowerCase();

        // Check for direct keyword matches
        const hasKeywords = jobKeywords.some(keyword => lowerContent.includes(keyword));

        // Check for common job post patterns
        const jobPatterns = [
            /we are (hiring|recruiting|looking for)/i,
            /(join|be part of) (our|the) team/i,
            /(open|available) (position|role|job)/i,
            /(apply|send) (now|today|your resume)/i,
            /looking for (a|an) .+ (developer|engineer|manager)/i,
            /(remote|hybrid|on-site) (position|role|job|work)/i
        ];

        const hasPatterns = jobPatterns.some(pattern => pattern.test(content));

        return hasKeywords || hasPatterns;
    }
}

// Export for use in content script
window.LinkedInParser = LinkedInParser;