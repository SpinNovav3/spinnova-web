// =============================================================================
// SpinNova Visit Tracker - Real-time website visit notifications
// =============================================================================
// Envoie les visites / téléchargements / leads vers Supabase (table "visits").
// Remplace l'ancien JSONBin : 1 insertion par évènement → pas de quota,
// pas d'écrasement entre visiteurs, pas de plafond 100.
// =============================================================================

(function () {
    'use strict';

    // =========================================================================
    // CONFIGURATION
    // =========================================================================
    const CONFIG = {
        // Projet Supabase "spinnova-tracker" (EU - Ireland)
        SUPABASE_URL: 'https://cedqkzmdeohioxivywmx.supabase.co',
        // Clé PUBLIQUE (publishable) : OK d'être visible ici, elle ne peut QUE
        // insérer une visite (jamais lire les leads ni supprimer — protégé par RLS).
        SUPABASE_KEY: 'sb_publishable_qAaJRaOWwmMi0DB1VohUkg_rRCQzv3C',
        SUPABASE_TABLE: 'visits',
        IMPORTANT_PAGES: ['/telechargement.html', '/boutique.html', '/essai-gratuit.html', '/activation.html', '/beta.html'],
        DEBUG: false
    };

    // =========================================================================
    // BOT DETECTION PATTERNS
    // =========================================================================
    const BOT_PATTERNS = [
        // Search engines
        { pattern: /googlebot/i, name: 'Googlebot' },
        { pattern: /bingbot/i, name: 'Bingbot' },
        { pattern: /yandexbot/i, name: 'Yandexbot' },
        { pattern: /baiduspider/i, name: 'Baiduspider' },
        { pattern: /duckduckbot/i, name: 'DuckDuckBot' },

        // AI crawlers
        { pattern: /ChatGPT-User/i, name: 'ChatGPT' },
        { pattern: /GPTBot/i, name: 'GPTBot' },
        { pattern: /Claude-Web/i, name: 'Claude' },
        { pattern: /anthropic-ai/i, name: 'Anthropic' },
        { pattern: /PerplexityBot/i, name: 'Perplexity' },
        { pattern: /Amazonbot/i, name: 'Amazonbot' },

        // SEO tools
        { pattern: /semrush/i, name: 'SEMrush' },
        { pattern: /ahrefs/i, name: 'Ahrefs' },
        { pattern: /mj12bot/i, name: 'Majestic' },
        { pattern: /dotbot/i, name: 'Moz' },

        // Social
        { pattern: /facebookexternalhit/i, name: 'Facebook' },
        { pattern: /twitterbot/i, name: 'Twitter' },
        { pattern: /linkedinbot/i, name: 'LinkedIn' },
        { pattern: /discordbot/i, name: 'Discord' },
        { pattern: /slackbot/i, name: 'Slack' },

        // Generic bot patterns
        { pattern: /bot/i, name: 'Bot' },
        { pattern: /spider/i, name: 'Spider' },
        { pattern: /crawler/i, name: 'Crawler' },
        { pattern: /headless/i, name: 'Headless' },
        { pattern: /phantom/i, name: 'PhantomJS' },
        { pattern: /selenium/i, name: 'Selenium' },
        { pattern: /puppeteer/i, name: 'Puppeteer' }
    ];

    // =========================================================================
    // UTILITY FUNCTIONS
    // =========================================================================

    function log(msg, data) {
        if (CONFIG.DEBUG) {
            console.log('[VisitTracker]', msg, data || '');
        }
    }

    function getVisitorId() {
        let visitorId = localStorage.getItem('spinnova_visitor_id');
        if (!visitorId) {
            visitorId = 'v_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
            localStorage.setItem('spinnova_visitor_id', visitorId);
        }
        return visitorId;
    }

    function isNewVisitor() {
        return !localStorage.getItem('spinnova_returning');
    }

    function markAsReturning() {
        localStorage.setItem('spinnova_returning', 'true');
    }

    function detectBot(userAgent) {
        for (const bot of BOT_PATTERNS) {
            if (bot.pattern.test(userAgent)) {
                return { isBot: true, name: bot.name };
            }
        }
        return { isBot: false, name: null };
    }

    function getDeviceType() {
        const ua = navigator.userAgent;
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
            return 'Tablet';
        }
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
            return 'Mobile';
        }
        return 'Desktop';
    }

    function getBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes('Firefox/')) return 'Firefox';
        if (ua.includes('Edg/')) return 'Edge';
        if (ua.includes('Chrome/')) return 'Chrome';
        if (ua.includes('Safari/')) return 'Safari';
        if (ua.includes('Opera/') || ua.includes('OPR/')) return 'Opera';
        return 'Unknown';
    }

    function getOS() {
        const ua = navigator.userAgent;
        if (ua.includes('Windows NT 10')) return 'Windows 10/11';
        if (ua.includes('Windows NT')) return 'Windows';
        if (ua.includes('Mac OS X')) return 'macOS';
        if (ua.includes('CrOS')) return 'ChromeOS';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
        if (ua.includes('Linux')) return 'Linux';
        return 'Unknown';
    }

    function getScreenResolution() {
        return window.screen.width + 'x' + window.screen.height;
    }

    function getSessionPageCount() {
        let count = parseInt(sessionStorage.getItem('spinnova_page_count') || '0', 10);
        count++;
        sessionStorage.setItem('spinnova_page_count', count.toString());
        return count;
    }

    function readSessionPageCount() {
        // Lecture SANS incrémenter (pour les records download/lead)
        return parseInt(sessionStorage.getItem('spinnova_page_count') || '1', 10);
    }

    function getUTMParams() {
        const params = new URLSearchParams(window.location.search);
        const utm = {};
        ['utm_source', 'utm_medium', 'utm_campaign'].forEach(key => {
            const val = params.get(key);
            if (val) utm[key] = val;
        });
        return Object.keys(utm).length > 0 ? utm : null;
    }

    // Scroll depth tracking
    let maxScrollDepth = 0;
    window.addEventListener('scroll', function () {
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight > 0) {
            const percent = Math.round((scrollTop / docHeight) * 100);
            if (percent > maxScrollDepth) maxScrollDepth = percent;
        }
    });

    function getLanguageInfo() {
        const lang = navigator.language || navigator.userLanguage || 'unknown';
        // Map common language codes to country flags
        const flagMap = {
            'fr': '🇫🇷', 'fr-FR': '🇫🇷', 'fr-BE': '🇧🇪', 'fr-CA': '🇨🇦', 'fr-CH': '🇨🇭',
            'en': '🇬🇧', 'en-US': '🇺🇸', 'en-GB': '🇬🇧', 'en-AU': '🇦🇺', 'en-CA': '🇨🇦',
            'es': '🇪🇸', 'es-ES': '🇪🇸', 'es-MX': '🇲🇽',
            'de': '🇩🇪', 'de-DE': '🇩🇪', 'de-AT': '🇦🇹', 'de-CH': '🇨🇭',
            'it': '🇮🇹', 'pt': '🇵🇹', 'pt-BR': '🇧🇷',
            'nl': '🇳🇱', 'pl': '🇵🇱', 'ru': '🇷🇺', 'ja': '🇯🇵', 'zh': '🇨🇳', 'ko': '🇰🇷'
        };
        const flag = flagMap[lang] || flagMap[lang.split('-')[0]] || '🌍';
        const isFrench = lang.startsWith('fr');
        return { code: lang, flag: flag, isFrench: isFrench };
    }

    function getReferrerInfo() {
        // On first page load, save the original referrer for the session
        // so internal navigation doesn't overwrite the real source
        const sessionRef = sessionStorage.getItem('spinnova_original_referrer');
        const ref = document.referrer;

        // Determine the raw source for THIS page load
        let source = 'Direct';
        if (ref) {
            try {
                const url = new URL(ref);
                const host = url.hostname.replace('www.', '');
                // Ignore internal navigation (same site on GitHub Pages)
                if (host === window.location.hostname) {
                    // Internal nav — use the saved original referrer if available
                    return sessionRef || 'Direct';
                }
                // Simplify common referrers
                if (host.includes('google')) source = 'Google';
                else if (host.includes('discord')) source = 'Discord';
                else if (host.includes('facebook')) source = 'Facebook';
                else if (host.includes('twitter') || host.includes('x.com')) source = 'Twitter/X';
                else if (host.includes('reddit')) source = 'Reddit';
                else if (host.includes('clubpoker')) source = 'ClubPoker';
                else if (host.includes('killtilt')) source = 'KillTilt';
                else if (host.includes('github.io')) source = 'Direct'; // Own GitHub Pages = internal
                else if (host.includes('github')) source = 'GitHub';
                else source = host;
            } catch {
                source = 'Unknown';
            }
        }

        // Check UTM source as fallback (e.g. links shared with ?utm_source=discord)
        const params = new URLSearchParams(window.location.search);
        const utmSource = params.get('utm_source');
        if (utmSource && source === 'Direct') {
            source = utmSource.charAt(0).toUpperCase() + utmSource.slice(1);
        }

        // Save the original referrer for this session (first page only)
        if (!sessionRef) {
            sessionStorage.setItem('spinnova_original_referrer', source);
        }

        return source;
    }

    function isImportantPage(page) {
        return CONFIG.IMPORTANT_PAGES.some(p => page.endsWith(p));
    }

    // =========================================================================
    // ENVOI VERS SUPABASE (1 insertion par évènement — remplace JSONBin)
    // =========================================================================
    // keepalive: true → l'envoi survit même si la page change (clic download).
    function sendRecord(record) {
        const row = {
            id: record.id || null,
            type: record.type || 'visit',
            visitor_id: record.visitor_id || null,
            page: record.page || null,
            data: record
        };
        return fetch(CONFIG.SUPABASE_URL + '/rest/v1/' + CONFIG.SUPABASE_TABLE, {
            method: 'POST',
            headers: {
                'apikey': CONFIG.SUPABASE_KEY,
                'Authorization': 'Bearer ' + CONFIG.SUPABASE_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(row),
            keepalive: true
        })
            .then(function (r) {
                if (r.ok) { log('✅ Record envoyé à Supabase:', record.type || 'visit'); }
                else { log('❌ Supabase a répondu ' + r.status); }
                return r;
            })
            .catch(function (err) { log('❌ Erreur envoi Supabase:', err.message); });
    }

    // =========================================================================
    // MAIN TRACKING LOGIC
    // =========================================================================

    function trackVisit() {
        const userAgent = navigator.userAgent;
        const botInfo = detectBot(userAgent);
        const langInfo = getLanguageInfo();
        const isNew = isNewVisitor();
        const page = window.location.pathname;

        const visitData = {
            id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
            visitor_id: getVisitorId(),
            timestamp: new Date().toISOString(),
            page: page,
            referrer: getReferrerInfo(),
            device: getDeviceType(),
            browser: getBrowser(),
            os: getOS(),
            screen_resolution: getScreenResolution(),
            session_page_count: getSessionPageCount(),
            utm: getUTMParams(),
            language: langInfo.code,
            flag: langInfo.flag,
            is_french: langInfo.isFrench,
            is_new: isNew,
            is_bot: botInfo.isBot,
            bot_name: botInfo.name,
            is_important: isImportantPage(page)
        };

        log('Visit data:', visitData);

        // Mark as returning for next visit
        if (isNew) {
            markAsReturning();
        }

        // 1 insertion Supabase
        sendRecord(visitData);
    }

    // =========================================================================
    // ENGAGEMENT TRACKING (heartbeat tant que l'utilisateur est sur la page)
    // =========================================================================

    let _lastSentScrollDepth = 0;
    let _lastSentTimeOnPage = 0;
    let _engagementSendInProgress = false;

    function sendEngagementData(isFinal) {
        if (_engagementSendInProgress) return;

        const timeOnPage = Math.round((Date.now() - pageLoadTime) / 1000);
        if (timeOnPage < 3) return; // Skip very short visits

        // Only send if there's meaningful new data since last send
        if (!isFinal && maxScrollDepth === _lastSentScrollDepth &&
            Math.abs(timeOnPage - _lastSentTimeOnPage) < 10) {
            return; // No significant change, skip
        }

        const engagementData = {
            id: 'eng_' + Date.now().toString(36),
            visitor_id: getVisitorId(),
            timestamp: new Date().toISOString(),
            page: window.location.pathname,
            type: 'engagement',
            scroll_depth: maxScrollDepth,
            time_on_page: timeOnPage
        };
        log('Engagement data:', engagementData);

        _engagementSendInProgress = true;
        sendRecord(engagementData)
            .then(function () {
                _lastSentScrollDepth = maxScrollDepth;
                _lastSentTimeOnPage = timeOnPage;
            })
            .finally(function () {
                _engagementSendInProgress = false;
            });
    }

    // =========================================================================
    // DOWNLOAD CLICK TRACKING
    // =========================================================================

    function setupDownloadTracking() {
        // Intercepte les clics sur les liens de téléchargement (tracking only).
        document.addEventListener('click', function (e) {
            var link = e.target.closest('a');
            if (!link) return;

            var href = link.getAttribute('href') || '';
            var isDirectDownload = href.indexOf('Spinova_Release') !== -1 || href.indexOf('.zip') !== -1;
            var isDownloadPage = href.indexOf('telechargement.html') !== -1 && window.location.pathname.indexOf('telechargement') === -1;

            if (!isDirectDownload && !isDownloadPage) return;

            var downloadType = isDirectDownload ? 'direct_download' : 'download_page_click';
            var visitorId = getVisitorId();
            var buttonText = (link.textContent || '').trim().substring(0, 100);

            var downloadRecord = {
                id: 'dl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                type: 'download',
                download_type: downloadType,
                visitor_id: visitorId,
                page: window.location.pathname,
                button_text: buttonText,
                target_url: href.substring(0, 200),
                timestamp: new Date().toISOString(),
                device: getDeviceType(),
                browser: getBrowser(),
                os: getOS(),
                screen_resolution: window.screen.width + 'x' + window.screen.height,
                language: navigator.language || '',
                referrer: getReferrerInfo(),
                session_page_count: readSessionPageCount(),
                is_new: isNewVisitor()
            };

            log('📥 Download click tracked:', downloadType, 'from', window.location.pathname);

            // Fire-and-forget (keepalive survit à la navigation)
            sendRecord(downloadRecord);
        });
    }

    // =========================================================================
    // LEAD CAPTURE (Contact collection at download)
    // =========================================================================

    function hasAlreadyGivenContact() {
        return localStorage.getItem('spinnova_lead_given') === 'true';
    }

    function markLeadGiven() {
        localStorage.setItem('spinnova_lead_given', 'true');
    }

    function trackLead(leadData) {
        var langInfo = getLanguageInfo();

        var leadRecord = {
            id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
            type: 'lead',
            visitor_id: getVisitorId(),
            discord_username: leadData.discord || '',
            email: leadData.email || '',
            contact_method: leadData.contactMethod || 'skipped',
            download_page: window.location.pathname,
            referrer: getReferrerInfo(),
            device: getDeviceType(),
            browser: getBrowser(),
            language: langInfo.code,
            flag: langInfo.flag,
            is_new: isNewVisitor(),
            timestamp: new Date().toISOString()
        };

        log('📋 Lead tracked:', leadRecord);
        markLeadGiven();

        // Retourne la Promise pour que l'appelant (popup) puisse attendre
        return sendRecord(leadRecord);
    }

    // =========================================================================
    // GLOBAL API (for popup to call)
    // =========================================================================
    window.SpinNovaTracker = {
        trackLead: trackLead,
        hasAlreadyGivenContact: hasAlreadyGivenContact
    };

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    const pageLoadTime = Date.now();

    // HEARTBEAT: envoie l'engagement toutes les 15s tant que la page est ouverte
    const _engagementInterval = setInterval(function () {
        sendEngagementData(false);
    }, 15000);

    // VISIBILITY CHANGE: plus fiable que beforeunload pour la donnée finale
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            clearInterval(_engagementInterval);
            sendEngagementData(true);
        }
    });

    // BEFOREUNLOAD: dernier filet (peu fiable mais ne coûte rien)
    window.addEventListener('beforeunload', function () {
        clearInterval(_engagementInterval);
        sendEngagementData(true);
    });

    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            trackVisit();
            setupDownloadTracking();
        });
    } else {
        trackVisit();
        setupDownloadTracking();
    }

})();
