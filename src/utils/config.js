// Central configuration for the LinkedIn Job Assistant Chrome Extension
class Config {
    // static ENVIRONMENT = 'production'; // Change to 'development' for local testing
    static ENVIRONMENT = 'development'; // Change to 'development' for local testing

    // Backend URL configuration - CHANGE ONLY THIS
    static BACKEND_URLS = {
        production: 'https://ai-chrome-extension-tool.onrender.com',
        development: 'http://127.0.0.1:5000'
    };

    // Get the current backend URL based on environment
    static getBackendUrl() {
        return this.BACKEND_URLS[this.ENVIRONMENT];
    }

    // Get the API base URL
    static getApiBaseUrl() {
        return `${this.getBackendUrl()}/api`;
    }

    // Get full API endpoint URL
    static getApiUrl(endpoint) {
        // Remove leading slash if present
        const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
        return `${this.getApiBaseUrl()}/${cleanEndpoint}`;
    }

    // Check if we're in development mode
    static isDevelopment() {
        return this.ENVIRONMENT === 'development';
    }

    // Check if we're in production mode
    static isProduction() {
        return this.ENVIRONMENT === 'production';
    }

    // Log current configuration (for debugging)
    static logConfig() {
        console.log('LinkedIn Job Assistant Configuration:', {
            environment: this.ENVIRONMENT,
            backendUrl: this.getBackendUrl(),
            apiBaseUrl: this.getApiBaseUrl()
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Config;
}

// Make available globally for Chrome extension
if (typeof window !== 'undefined') {
    window.Config = Config;
}
