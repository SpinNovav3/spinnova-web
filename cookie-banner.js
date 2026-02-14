/**
 * SpinNova — RGPD Cookie Consent Banner
 * Gère le consentement pour Microsoft Clarity.
 * Si l'utilisateur refuse, Clarity ne se charge pas.
 */
(function () {
    const CONSENT_KEY = 'spinnova_cookie_consent';

    // Si déjà consenti → rien à faire (Clarity chargé conditionnellement)
    const existing = localStorage.getItem(CONSENT_KEY);
    if (existing === 'accepted') {
        loadClarity();
        return;
    }
    if (existing === 'refused') {
        return; // Ne pas charger Clarity, ne pas afficher le bandeau
    }

    // Créer le bandeau
    document.addEventListener('DOMContentLoaded', function () {
        const banner = document.createElement('div');
        banner.id = 'cookie-banner';
        banner.innerHTML = `
            <div class="cookie-content">
                <p>🍪 Ce site utilise <strong>Microsoft Clarity</strong> pour analyser la navigation et améliorer l'expérience utilisateur. Aucune donnée personnelle n'est revendue.</p>
                <div class="cookie-buttons">
                    <button id="cookie-accept" class="cookie-btn accept">Accepter</button>
                    <button id="cookie-refuse" class="cookie-btn refuse">Refuser</button>
                </div>
            </div>
        `;

        // Styles inline pour autonomie totale (pas de dépendance CSS externe)
        banner.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 99999;
            padding: 1rem 2rem;
            background: rgba(15, 15, 25, 0.95);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-top: 1px solid rgba(138, 92, 246, 0.3);
            box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.5);
            font-family: 'Outfit', sans-serif;
            animation: slideUp 0.4s ease-out;
        `;

        // Ajouter l'animation CSS
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideUp {
                from { transform: translateY(100%); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            #cookie-banner .cookie-content {
                max-width: 1000px;
                margin: 0 auto;
                display: flex;
                align-items: center;
                gap: 1.5rem;
                flex-wrap: wrap;
                justify-content: center;
            }
            #cookie-banner p {
                color: #b0b0c0;
                font-size: 0.9rem;
                margin: 0;
                flex: 1;
                min-width: 250px;
            }
            #cookie-banner strong {
                color: #fff;
            }
            #cookie-banner .cookie-buttons {
                display: flex;
                gap: 0.75rem;
                flex-shrink: 0;
            }
            #cookie-banner .cookie-btn {
                padding: 0.5rem 1.5rem;
                border: none;
                border-radius: 8px;
                font-family: 'Outfit', sans-serif;
                font-size: 0.85rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
            }
            #cookie-banner .cookie-btn.accept {
                background: linear-gradient(135deg, #8a5cf6, #6d3bdb);
                color: white;
            }
            #cookie-banner .cookie-btn.accept:hover {
                background: linear-gradient(135deg, #9d73f7, #7e4ee6);
                transform: translateY(-1px);
                box-shadow: 0 4px 15px rgba(138, 92, 246, 0.4);
            }
            #cookie-banner .cookie-btn.refuse {
                background: rgba(255, 255, 255, 0.08);
                color: #b0b0c0;
                border: 1px solid rgba(255, 255, 255, 0.15);
            }
            #cookie-banner .cookie-btn.refuse:hover {
                background: rgba(255, 255, 255, 0.12);
                color: #fff;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(banner);

        // Event listeners
        document.getElementById('cookie-accept').addEventListener('click', function () {
            localStorage.setItem(CONSENT_KEY, 'accepted');
            loadClarity();
            closeBanner();
        });

        document.getElementById('cookie-refuse').addEventListener('click', function () {
            localStorage.setItem(CONSENT_KEY, 'refused');
            closeBanner();
        });
    });

    function closeBanner() {
        const banner = document.getElementById('cookie-banner');
        if (banner) {
            banner.style.animation = 'slideUp 0.3s ease-in reverse';
            setTimeout(function () { banner.remove(); }, 300);
        }
    }

    function loadClarity() {
        // Charger Microsoft Clarity dynamiquement
        (function (c, l, a, r, i, t, y) {
            c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
            t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
            y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
        })(window, document, "clarity", "script", "vccus3mpsa");
    }
})();
