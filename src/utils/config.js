// Central configuration for the LinkedIn Job Assistant Chrome Extension
class Config {
    // static ENVIRONMENT = 'production'; // Change to 'development' for local testing
    static ENVIRONMENT = 'development'; // Change to 'development' for local testing

    // Backend URL configuration - CHANGE ONLY THIS
    static BACKEND_URLS = {
        production: 'https://ai-chrome-extension-tool.onrender.com',
        development: 'http://127.0.0.1:5000'
    };

    // Design System - Modern Color Palette and Design Tokens
    static DESIGN = {
        // Color themes - Light and Dark mode support
        themes: {
            light: {
                // Primary Brand Colors (same for both themes)
                primary: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9',  // Main primary
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e'
                },

                // Secondary Colors
                secondary: {
                    50: '#faf5ff',
                    100: '#f3e8ff',
                    200: '#e9d5ff',
                    300: '#d8b4fe',
                    400: '#c084fc',
                    500: '#a855f7',
                    600: '#9333ea',
                    700: '#7c3aed',
                    800: '#6b21a8',
                    900: '#581c87'
                },

                // Success Colors
                success: {
                    50: '#f0fdf4',
                    100: '#dcfce7',
                    200: '#bbf7d0',
                    300: '#86efac',
                    400: '#4ade80',
                    500: '#22c55e',
                    600: '#16a34a',
                    700: '#15803d',
                    800: '#166534',
                    900: '#14532d'
                },

                // Warning Colors
                warning: {
                    50: '#fffbeb',
                    100: '#fef3c7',
                    200: '#fde68a',
                    300: '#fcd34d',
                    400: '#fbbf24',
                    500: '#f59e0b',
                    600: '#d97706',
                    700: '#b45309',
                    800: '#92400e',
                    900: '#78350f'
                },

                // Error Colors
                error: {
                    50: '#fef2f2',
                    100: '#fee2e2',
                    200: '#fecaca',
                    300: '#fca5a5',
                    400: '#f87171',
                    500: '#ef4444',
                    600: '#dc2626',
                    700: '#b91c1c',
                    800: '#991b1b',
                    900: '#7f1d1d'
                },

                // Light mode neutral colors
                neutral: {
                    50: '#ffffff',    // Pure white for cards/surfaces
                    100: '#f8fafc',   // Very light gray for backgrounds
                    200: '#f1f5f9',   // Light gray for subtle borders
                    300: '#e2e8f0',   // Medium-light gray for borders
                    400: '#cbd5e1',   // Medium gray for disabled elements
                    500: '#94a3b8',   // Medium gray for secondary text
                    600: '#64748b',   // Dark gray for tertiary text
                    700: '#475569',   // Dark gray for secondary text
                    800: '#334155',   // Very dark gray for primary text
                    900: '#1e293b',   // Nearly black for headings
                    950: '#0f172a'    // Pure black
                },

                // Semantic surface colors for light mode
                surface: {
                    primary: '#ffffff',      // Main card/modal backgrounds
                    secondary: '#f8fafc',    // Page backgrounds
                    elevated: '#ffffff',     // Elevated surfaces (dropdowns, tooltips)
                    overlay: 'rgba(0, 0, 0, 0.6)'  // Modal overlays
                },

                // Text colors for light mode
                text: {
                    primary: '#1e293b',      // Main text
                    secondary: '#475569',    // Secondary text
                    tertiary: '#64748b',     // Tertiary/helper text
                    inverse: '#ffffff',      // Text on dark backgrounds
                    disabled: '#94a3b8'      // Disabled text
                }
            },

            dark: {
                // Primary colors (slightly adjusted for dark mode)
                primary: {
                    50: '#0c1420',
                    100: '#162033',
                    200: '#1e3a52',
                    300: '#2563eb',
                    400: '#3b82f6',
                    500: '#60a5fa',  // Lighter primary for dark mode
                    600: '#93c5fd',
                    700: '#bfdbfe',
                    800: '#dbeafe',
                    900: '#eff6ff'
                },

                // Secondary colors for dark mode
                secondary: {
                    50: '#1e1b31',
                    100: '#2d2748',
                    200: '#3d3560',
                    300: '#6366f1',
                    400: '#8b5cf6',
                    500: '#a78bfa',
                    600: '#c4b5fd',
                    700: '#ddd6fe',
                    800: '#ede9fe',
                    900: '#f5f3ff'
                },

                // Success colors for dark mode
                success: {
                    50: '#0d1f17',
                    100: '#163a27',
                    200: '#1f5437',
                    300: '#16a34a',
                    400: '#22c55e',
                    500: '#4ade80',
                    600: '#86efac',
                    700: '#bbf7d0',
                    800: '#dcfce7',
                    900: '#f0fdf4'
                },

                // Warning colors for dark mode
                warning: {
                    50: '#1f1611',
                    100: '#3a2817',
                    200: '#54391d',
                    300: '#d97706',
                    400: '#f59e0b',
                    500: '#fbbf24',
                    600: '#fcd34d',
                    700: '#fde68a',
                    800: '#fef3c7',
                    900: '#fffbeb'
                },

                // Error colors for dark mode
                error: {
                    50: '#1f1315',
                    100: '#3a1f23',
                    200: '#542b31',
                    300: '#dc2626',
                    400: '#ef4444',
                    500: '#f87171',
                    600: '#fca5a5',
                    700: '#fecaca',
                    800: '#fee2e2',
                    900: '#fef2f2'
                },

                // Dark mode neutral colors
                neutral: {
                    50: '#0f172a',    // Dark backgrounds
                    100: '#1e293b',   // Card backgrounds
                    200: '#334155',   // Elevated surfaces
                    300: '#475569',   // Borders
                    400: '#64748b',   // Subtle borders
                    500: '#94a3b8',   // Disabled elements
                    600: '#cbd5e1',   // Secondary text
                    700: '#e2e8f0',   // Primary text
                    800: '#f1f5f9',   // High contrast text
                    900: '#f8fafc',   // Pure white text
                    950: '#ffffff'    // Maximum contrast
                },

                // Semantic surface colors for dark mode
                surface: {
                    primary: '#1e293b',      // Main card/modal backgrounds
                    secondary: '#0f172a',    // Page backgrounds
                    elevated: '#334155',     // Elevated surfaces
                    overlay: 'rgba(0, 0, 0, 0.8)'  // Modal overlays (darker)
                },

                // Text colors for dark mode
                text: {
                    primary: '#f1f5f9',      // Main text (light gray)
                    secondary: '#cbd5e1',    // Secondary text
                    tertiary: '#94a3b8',     // Tertiary/helper text
                    inverse: '#1e293b',      // Text on light backgrounds
                    disabled: '#64748b'      // Disabled text
                }
            }
        },

        // Current theme (can be 'light' or 'dark')
        currentTheme: 'light',

        // Method to get current theme colors
        get colors() {
            return this.themes[this.currentTheme];
        },

        // Typography Scale
        typography: {
            fontFamily: {
                primary: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                mono: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
            },
            fontSize: {
                xs: '0.75rem',     // 12px
                sm: '0.875rem',    // 14px
                base: '1rem',      // 16px
                lg: '1.125rem',    // 18px
                xl: '1.25rem',     // 20px
                '2xl': '1.5rem',   // 24px
                '3xl': '1.875rem', // 30px
                '4xl': '2.25rem',  // 36px
                '5xl': '3rem'      // 48px
            },
            fontWeight: {
                light: '300',
                normal: '400',
                medium: '500',
                semibold: '600',
                bold: '700',
                extrabold: '800'
            },
            lineHeight: {
                tight: '1.25',
                normal: '1.5',
                relaxed: '1.75'
            }
        },

        // Spacing Scale (8px base)
        spacing: {
            px: '1px',
            0: '0',
            1: '0.25rem',  // 4px
            2: '0.5rem',   // 8px
            3: '0.75rem',  // 12px
            4: '1rem',     // 16px
            5: '1.25rem',  // 20px
            6: '1.5rem',   // 24px
            8: '2rem',     // 32px
            10: '2.5rem',  // 40px
            12: '3rem',    // 48px
            16: '4rem',    // 64px
            20: '5rem',    // 80px
            24: '6rem'     // 96px
        },

        // Border Radius
        borderRadius: {
            none: '0',
            sm: '0.125rem',   // 2px
            base: '0.25rem',  // 4px
            md: '0.375rem',   // 6px
            lg: '0.5rem',     // 8px
            xl: '0.75rem',    // 12px
            '2xl': '1rem',    // 16px
            '3xl': '1.5rem',  // 24px
            full: '9999px'
        },

        // Box Shadow
        boxShadow: {
            sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
        },

        // Animation/Transition
        transition: {
            fast: '150ms ease',
            normal: '300ms ease',
            slow: '500ms ease'
        },

        // Z-Index Scale
        zIndex: {
            hide: -1,
            auto: 'auto',
            base: 0,
            docked: 10,
            dropdown: 1000,
            sticky: 1020,
            banner: 1030,
            overlay: 1040,
            modal: 1050,
            popover: 1060,
            skipLink: 1070,
            toast: 1080,
            tooltip: 1090
        }
    };

    // Theme management methods
    static setTheme(theme) {
        if (this.DESIGN.themes[theme]) {
            this.DESIGN.currentTheme = theme;
            this.updateCSSVariables();

            // Store preference in localStorage
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('linkedin-assistant-theme', theme);
            }

            // Dispatch custom event for other parts of the app
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));

                // Broadcast to other tabs using BroadcastChannel if available
                if (this.themeChannel) {
                    try {
                        this.themeChannel.postMessage({ type: 'theme-change', theme });
                    } catch (error) {
                        console.log('Failed to broadcast theme change:', error);
                    }
                }
            }
        }
    }

    static getTheme() {
        return this.DESIGN.currentTheme;
    }

    static toggleTheme() {
        const newTheme = this.DESIGN.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        return newTheme;
    }

    static initTheme() {
        // Check for saved theme preference
        const savedTheme = typeof localStorage !== 'undefined'
            ? localStorage.getItem('linkedin-assistant-theme')
            : null;

        // For first-time users, default to dark theme
        if (savedTheme) {
            this.setTheme(savedTheme);
        } else {
            // Default to dark theme as requested
            this.setTheme('dark');
        }

        // Listen for system theme changes
        if (typeof window !== 'undefined' && window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', (e) => {
                // Only auto-switch if user hasn't manually set a preference
                if (!savedTheme) {
                    this.setTheme(e.matches ? 'dark' : 'light');
                }
            });
        }

        // Listen for theme changes from other tabs/windows (real-time sync)
        this.setupCrossTabThemeSync();
    }

    // Setup cross-tab theme synchronization
    static setupCrossTabThemeSync() {
        if (typeof window === 'undefined') return;

        // Listen for localStorage changes from other tabs
        window.addEventListener('storage', (e) => {
            if (e.key === 'linkedin-assistant-theme' && e.newValue) {
                // Only update if the theme actually changed
                if (e.newValue !== this.DESIGN.currentTheme) {
                    this.DESIGN.currentTheme = e.newValue;
                    this.updateCSSVariables();
                    // Dispatch event to update UI
                    window.dispatchEvent(new CustomEvent('themeChanged', {
                        detail: { theme: e.newValue, source: 'cross-tab' }
                    }));
                }
            }
        });

        // Optional: Use BroadcastChannel for same-origin communication
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                this.themeChannel = new BroadcastChannel('linkedin-assistant-theme');
                this.themeChannel.addEventListener('message', (e) => {
                    if (e.data.type === 'theme-change' && e.data.theme !== this.DESIGN.currentTheme) {
                        this.DESIGN.currentTheme = e.data.theme;
                        this.updateCSSVariables();
                        window.dispatchEvent(new CustomEvent('themeChanged', {
                            detail: { theme: e.data.theme, source: 'broadcast' }
                        }));
                    }
                });
            } catch (error) {
                console.log('BroadcastChannel not available, using localStorage only');
            }
        }
    }

    static updateCSSVariables() {
        if (typeof document === 'undefined') return;

        const root = document.documentElement;
        const colors = this.DESIGN.colors;

        // Update CSS custom properties
        const updateColorVars = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'object' && value !== null) {
                    updateColorVars(value, `${prefix}${key}-`);
                } else {
                    root.style.setProperty(`--color-${prefix}${key}`, value);
                }
            }
        };

        updateColorVars(colors);

        // Update theme class on body and html
        document.documentElement.classList.remove('theme-light', 'theme-dark');
        document.documentElement.classList.add(`theme-${this.DESIGN.currentTheme}`);

        if (document.body) {
            document.body.classList.remove('theme-light', 'theme-dark');
            document.body.classList.add(`theme-${this.DESIGN.currentTheme}`);
        }

        // Update meta theme-color for mobile browsers
        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.head.appendChild(metaThemeColor);
        }
        metaThemeColor.content = colors.primary[500];
    }

    // Helper methods for easy access to design tokens
    static getColor(colorPath) {
        const pathArray = colorPath.split('.');
        let current = this.DESIGN.colors;
        for (const key of pathArray) {
            current = current[key];
            if (!current) return null;
        }
        return current;
    }

    static getSpacing(size) {
        return this.DESIGN.spacing[size] || size;
    }

    static getBorderRadius(size) {
        return this.DESIGN.borderRadius[size] || size;
    }

    static getBoxShadow(size) {
        return this.DESIGN.boxShadow[size] || size;
    }

    static getFontSize(size) {
        return this.DESIGN.typography.fontSize[size] || size;
    }

    // Generate CSS custom properties for use in stylesheets
    static generateCSSVariables() {
        const cssVars = [];
        const colors = this.DESIGN.colors;

        // Colors
        const flattenColors = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'object' && value !== null) {
                    flattenColors(value, `${prefix}${key}-`);
                } else {
                    cssVars.push(`--color-${prefix}${key}: ${value};`);
                }
            }
        };
        flattenColors(colors);

        // Typography
        for (const [key, value] of Object.entries(this.DESIGN.typography.fontSize)) {
            cssVars.push(`--font-size-${key}: ${value};`);
        }

        for (const [key, value] of Object.entries(this.DESIGN.typography.fontWeight)) {
            cssVars.push(`--font-weight-${key}: ${value};`);
        }

        // Spacing
        for (const [key, value] of Object.entries(this.DESIGN.spacing)) {
            cssVars.push(`--spacing-${key}: ${value};`);
        }

        // Border Radius
        for (const [key, value] of Object.entries(this.DESIGN.borderRadius)) {
            cssVars.push(`--radius-${key}: ${value};`);
        }

        // Shadows (adjust for dark mode)
        const isDark = this.DESIGN.currentTheme === 'dark';
        for (const [key, value] of Object.entries(this.DESIGN.boxShadow)) {
            if (isDark) {
                // Enhance shadows for dark mode
                const darkShadow = value.replace(/rgba\(0, 0, 0, ([\d.]+)\)/g, 'rgba(0, 0, 0, $1)');
                cssVars.push(`--shadow-${key}: ${darkShadow};`);
            } else {
                cssVars.push(`--shadow-${key}: ${value};`);
            }
        }

        return cssVars.join('\n    ');
    }

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
            apiBaseUrl: this.getApiBaseUrl(),
            designSystem: this.DESIGN
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
