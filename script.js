// Navigation active state
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Scroll spy for nav
    const sections = document.querySelectorAll('section[id]');
    window.addEventListener('scroll', () => {
        const scrollY = window.scrollY + 100;
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');

            if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === '#' + sectionId) {
                        link.classList.add('active');
                    }
                });
            }
        });
    });

    // Chat functionality (placeholder - for Telegram API integration)
    const chatInput = document.getElementById('chatInput');
    const chatSend = document.getElementById('chatSend');
    const chatMessages = document.getElementById('chatMessages');

    function sendMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        // Remove welcome message
        const welcome = chatMessages.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        // Add sent message
        const msgEl = document.createElement('div');
        msgEl.className = 'chat-message sent';
        msgEl.textContent = message;
        chatMessages.appendChild(msgEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        chatInput.value = '';

        // Auto reply placeholder
        setTimeout(() => {
            const replyEl = document.createElement('div');
            replyEl.className = 'chat-message received';
            replyEl.textContent = '텔레그램으로 연결됩니다. 잠시만 기다려주세요.';
            chatMessages.appendChild(replyEl);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 1000);
    }

    if (chatSend) {
        chatSend.addEventListener('click', sendMessage);
    }
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // Header background on scroll
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.borderBottomColor = 'var(--border-light)';
        } else {
            header.style.borderBottomColor = 'var(--border)';
        }
    });

    // Animate elements on scroll
    const observerOptions = {
        threshold: 0.05,
        rootMargin: '0px 0px 0px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-in');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Apply animation to cards
    const animatedElements = document.querySelectorAll('.exchange-card, .career-item, .challenge-card, .sidebar-card');
    animatedElements.forEach((el, i) => {
        el.classList.add('animate-ready');
        el.style.transitionDelay = (i * 0.05) + 's';
        observer.observe(el);
    });
});
