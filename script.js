document.addEventListener('DOMContentLoaded', () => {

    // ===== ADMIN OVERRIDES =====
    // Text overrides: replace innerText if value exists
    document.querySelectorAll('[data-admin]').forEach(el => {
        const val = localStorage.getItem('admin_' + el.dataset.admin);
        if (val) el.textContent = val;
    });

    // Link overrides
    const linkMap = {
        link_telegram: 'https://t.me/cuongmanager',
        link_discord: 'https://discord.com/invite/T3hQr5uwr4',
        link_kakao: 'https://open.kakao.com/o/gZAY8Lsh',
        link_edu_form: 'https://docs.google.com/forms/d/e/1FAIpQLSfDlPvP_qZ_ys8NzLu5crXVX3u0Ksi4nWo261vm_Mn37jz7Iw/viewform?usp=header',
        link_viewpoint_form: 'https://docs.google.com/forms/d/e/1FAIpQLSddA8O4Wthv43rk6OQxJwh4c0-qLYDqbYK8d5j_YKiItUknSg/viewform?usp=header',
        link_indicator_form: 'https://docs.google.com/forms/d/e/1FAIpQLSfzvjRowrgiZCzbE-W5CfqSUrZG6cPl-s7mma7aVQH_bI53Dw/viewform?usp=header'
    };
    Object.keys(linkMap).forEach(key => {
        const newUrl = localStorage.getItem('admin_' + key);
        if (!newUrl) return;
        const oldUrl = linkMap[key];
        document.querySelectorAll('a[href="' + oldUrl + '"]').forEach(a => { a.href = newUrl; });
    });

    // ===== SPA PAGE ROUTING =====
    const navLinks = document.querySelectorAll('.nav-link[data-page]');
    const pages = document.querySelectorAll('.page');

    function showPage(pageId) {
        pages.forEach(p => p.classList.remove('active'));
        const target = document.getElementById('page-' + pageId);
        if (target) target.classList.add('active');
        navLinks.forEach(l => l.classList.remove('active'));
        navLinks.forEach(l => { if (l.dataset.page === pageId) l.classList.add('active'); });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(link.dataset.page);
        });
    });

    // Nav cards (3-column) also route pages
    document.querySelectorAll('.nav-card[data-page]').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(card.dataset.page);
        });
    });

    // ===== MOBILE MENU =====
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const mainNav = document.getElementById('mainNav');
    mobileMenuBtn.addEventListener('click', () => {
        mainNav.classList.toggle('open');
        mobileMenuBtn.innerHTML = mainNav.classList.contains('open')
            ? '<i class="fas fa-times"></i>'
            : '<i class="fas fa-bars"></i>';
    });
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            mainNav.classList.remove('open');
            mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
        });
    });

    // ===== DARK MODE =====
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateThemeIcon(next);
    });

    function updateThemeIcon(theme) {
        themeToggle.innerHTML = theme === 'light'
            ? '<i class="fas fa-moon"></i>'
            : '<i class="fas fa-sun"></i>';
    }

    // ===== LANGUAGE SWITCHER =====
    const langBtn = document.getElementById('langBtn');
    const langDropdown = document.getElementById('langDropdown');
    const langLabel = document.getElementById('langLabel');
    const langButtons = langDropdown.querySelectorAll('button');
    let currentLang = localStorage.getItem('lang') || 'en';

    const translations = {
        ko: {
            hero_title: '검증된 트레이더, <span>쿠엉</span>',
            hero_desc: '유튜브 라이브로 모든 트레이딩을 증명합니다. 좋은 손익비와 극강의 리스크 관리로 <strong>낮은 레버리지로도 강력한 수익</strong>을 만들어냅니다.',
            hero_btn_community: '커뮤니티 입장하기',
            hero_btn_telegram: '텔레그램 문의',
            stat_years: '트레이딩 경력 (년)',
            stat_wins: '대회 1위 달성',
            stat_profit: '챌린지 총 수익',
            career_title: '쿠엉의 커리어',
            career_exp: '매매 경력',
            career_major: '메이저 거래소 대회',
            challenge_title: '유튜브 라이브 검증 트레이딩 챌린지',
            challenge_sub: '유튜브 채널 개설: 2024년 9월',
            exchange_title: '국내 입출금 가능 거래소',
            th_name: '거래소명', th_type: '종류', th_payback: '수수료 할인', th_maker: '지정가', th_taker: '시장가',
            btn_signup: '가입하기',
            event_title: '이벤트에 참여해보세요!',
            event_empty: '진행중인 이벤트가 없습니다.',
            event_soon: '새로운 이벤트가 곧 업데이트됩니다.',
            cta_community_title: '쿠엉 공식 커뮤니티',
            cta_community_desc: '쿠엉 공식 디스코드에 입장하여 최신 공지사항과 실시간 차트 관점을 확인해 보세요.',
            cta_community_btn: '커뮤니티 입장하기',
            cta_ask_title: '궁금한점이 있으신가요?',
            cta_ask_desc: '텔레그램을 통해 실시간 문의가 가능합니다<br>몇 분 내 연결이 되니 조금만 기다려주세요!',
            cta_ask_btn: '고객센터 문의하기'
        },
        en: {
            hero_title: 'Verified Trader, <span>CUONG</span>',
            hero_desc: 'All trades proven through YouTube live streams. With excellent risk-reward ratios and extreme risk management, <strong>achieving powerful returns even with low leverage</strong>.',
            hero_btn_community: 'Join Community',
            hero_btn_telegram: 'Telegram Inquiry',
            stat_years: 'Years of Trading',
            stat_wins: '1st Place Wins',
            stat_profit: 'Total Challenge Profit',
            career_title: 'Cuong\'s Career',
            career_exp: 'Trading Experience',
            career_major: 'Major Exchange Competitions',
            challenge_title: 'YouTube Live Verified Trading Challenge',
            challenge_sub: 'YouTube Channel Opened: September 2024',
            exchange_title: 'Supported Exchanges',
            th_name: 'Exchange', th_type: 'Type', th_payback: 'Fee Discount', th_maker: 'Maker', th_taker: 'Taker',
            btn_signup: 'Sign Up',
            event_title: 'Join Our Events!',
            event_empty: 'No ongoing events.',
            event_soon: 'New events will be updated soon.',
            cta_community_title: 'Cuong Official Community',
            cta_community_desc: 'Join Cuong\'s official Discord for the latest announcements and real-time chart analysis.',
            cta_community_btn: 'Join Community',
            cta_ask_title: 'Have Questions?',
            cta_ask_desc: 'Real-time inquiries available via Telegram.<br>Connection within a few minutes!',
            cta_ask_btn: 'Contact Support'
        },
        zh: {
            hero_title: '经验证的交易员, <span>CUONG</span>',
            hero_desc: '通过YouTube直播验证所有交易。凭借出色的风险回报比和极致的风险管理，<strong>即使低杠杆也能实现强劲收益</strong>。',
            hero_btn_community: '加入社区',
            hero_btn_telegram: 'Telegram 咨询',
            stat_years: '交易经验 (年)',
            stat_wins: '冠军次数',
            stat_profit: '挑战总利润',
            career_title: 'Cuong 的职业经历',
            career_exp: '交易经验',
            career_major: '主要交易所比赛',
            challenge_title: 'YouTube直播验证交易挑战',
            challenge_sub: 'YouTube频道创建: 2024年9月',
            exchange_title: '支持的交易所',
            th_name: '交易所', th_type: '类型', th_payback: '手续费折扣', th_maker: '挂单', th_taker: '吃单',
            btn_signup: '注册',
            event_title: '参与活动！',
            event_empty: '没有正在进行的活动。',
            event_soon: '新活动即将更新。',
            cta_community_title: 'Cuong 官方社区',
            cta_community_desc: '加入Cuong官方Discord，获取最新公告和实时图表分析。',
            cta_community_btn: '加入社区',
            cta_ask_title: '有疑问吗？',
            cta_ask_desc: '可以通过Telegram进行实时咨询。<br>几分钟内即可连接！',
            cta_ask_btn: '联系客服'
        }
    };

    const langNames = { ko: '한국어', en: 'English', zh: '中文' };

    function applyLang(lang) {
        currentLang = lang;
        localStorage.setItem('lang', lang);
        langLabel.textContent = langNames[lang];
        langButtons.forEach(b => b.classList.toggle('active', b.dataset.lang === lang));
        document.documentElement.setAttribute('data-lang', lang);
        const t = translations[lang];
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (!t[key]) return;
            const svgs = el.querySelectorAll(':scope > svg');
            if (svgs.length > 0) {
                const fragment = document.createDocumentFragment();
                svgs.forEach(svg => fragment.appendChild(svg.cloneNode(true)));
                el.innerHTML = '';
                el.appendChild(fragment);
                el.insertAdjacentHTML('beforeend', ' ' + t[key]);
            } else {
                el.innerHTML = t[key];
            }
        });
        langDropdown.classList.remove('show');
    }

    langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        langDropdown.classList.toggle('show');
    });
    langButtons.forEach(btn => {
        btn.addEventListener('click', () => applyLang(btn.dataset.lang));
    });
    document.addEventListener('click', () => langDropdown.classList.remove('show'));

    applyLang(currentLang);

    // ===== SCROLL ANIMATIONS =====
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.05 });

    document.querySelectorAll('.text-card, .table-card, .cta-card, .empty-card, .event-card, .indicator-video-wrap').forEach((el, i) => {
        el.classList.add('animate-ready');
        el.style.transitionDelay = (i * 0.06) + 's';
        observer.observe(el);
    });

    // Stagger children (nav-cards, edu-grid, review-grid)
    document.querySelectorAll('.stagger-children').forEach(container => {
        container.classList.add('animate-ready');
        observer.observe(container);
    });

    // Stat inline items
    document.querySelectorAll('.stat-inline-item').forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(12px)';
        el.style.transition = `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`;
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        obs.observe(el);
    });

    // Glow badges
    document.querySelectorAll('.glow-badge').forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(-12px)';
        el.style.transition = `opacity 0.4s ease, transform 0.4s ease`;
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateX(0)';
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
        obs.observe(el);
    });

    // Hero stats
    document.querySelectorAll('.hero-stat-card').forEach((el, i) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        el.style.transition = `opacity 0.4s ease ${i * 0.08}s, transform 0.4s ease ${i * 0.08}s`;
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });
        obs.observe(el);
    });

    // ===== YOUTUBE FACADE =====
    document.querySelectorAll('.yt-facade').forEach(facade => {
        facade.addEventListener('click', () => {
            const videoId = facade.dataset.videoId;
            const iframe = document.createElement('iframe');
            iframe.src = 'https://www.youtube.com/embed/' + videoId + '?autoplay=1&vq=hd1080&hd=1';
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
            iframe.setAttribute('allowfullscreen', '');
            iframe.style.width = '100%';
            iframe.style.aspectRatio = '16/9';
            iframe.style.display = 'block';
            facade.replaceWith(iframe);
        });
    });

    // ===== LIGHTBOX =====
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxClose = document.getElementById('lightboxClose');

    document.querySelectorAll('.review-item img').forEach(img => {
        img.addEventListener('click', () => {
            lightboxImg.src = img.src;
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }

    lightboxClose.addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });
});
