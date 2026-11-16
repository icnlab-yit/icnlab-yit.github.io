/* ==========================================================================
   ICN Lab @ KBRI — Full-Page Navigation, Transitions & Neural Canvas
   ========================================================================== */

(() => {
  'use strict';

  const fullpage = document.getElementById('fullpage');
  const sections = Array.from(document.querySelectorAll('.page-section'));
  const navLinks = Array.from(document.querySelectorAll('.nav-link'));
  const dotBtns = Array.from(document.querySelectorAll('.dot-btn'));
  const gotoTriggers = Array.from(document.querySelectorAll('[data-goto]'));
  const pageCounterEl = document.getElementById('current-page-num');
  const progressBarEl = document.getElementById('header-progress-bar');

  const navToggle = document.getElementById('nav-toggle');
  const mainNav = document.getElementById('main-nav');

  const totalSections = sections.length;
  const desktopQuery = window.matchMedia('(min-width: 900px) and (min-height: 650px)');
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  let currentIndex = 0;
  let isTransitioning = false;
  let transitionTimer = null;
  let wheelAccumulator = 0;
  let lastWheelTs = 0;
  let gestureConsumed = false;

  /* ------------------------------------------------------------------------
     Canva Slide Export Mode (?canva=1)
     ------------------------------------------------------------------------ */
  let initialIndex = 0;

  if (window.location.search.includes('canva=1')) {
    document.body.classList.add('canva-export-mode');
    const urlParams = new URLSearchParams(window.location.search);
    const secParam = urlParams.get('sec');
    if (secParam) {
      document.body.dataset.exportSec = secParam;
      const targetId = `sec-${secParam}`;
      sections.forEach((sec) => {
        if (sec.id === targetId) {
          sec.style.setProperty('display', 'flex', 'important');
        } else {
          sec.style.setProperty('display', 'none', 'important');
        }
      });
      const parsedSec = parseInt(secParam, 10);
      if (!Number.isNaN(parsedSec) && parsedSec >= 1 && parsedSec <= totalSections) {
        initialIndex = parsedSec - 1;
      }
    }
  }

  /* ------------------------------------------------------------------------
     Active Section State & UI Sync
     ------------------------------------------------------------------------ */
  function setActiveSection(index) {
    if (index < 0 || index >= totalSections) return;
    currentIndex = index;

    sections.forEach((sec, i) => {
      sec.classList.toggle('is-active', i === index);
    });

    navLinks.forEach((link) => {
      const target = Number(link.dataset.goto);
      link.classList.toggle('is-active', target === index);
    });

    dotBtns.forEach((dot) => {
      const target = Number(dot.dataset.goto);
      const active = target === index;
      dot.classList.toggle('is-active', active);
      dot.setAttribute('aria-current', active ? 'step' : 'false');
    });

    if (pageCounterEl) {
      pageCounterEl.textContent = String(index + 1).padStart(2, '0');
    }

    if (progressBarEl) {
      const pct = ((index + 1) / totalSections) * 100;
      progressBarEl.style.width = `${pct}%`;
    }
  }

  /* ------------------------------------------------------------------------
     Smooth Scroll Navigation
     ------------------------------------------------------------------------ */
  function releaseTransition() {
    clearTimeout(transitionTimer);
    transitionTimer = null;
    isTransitioning = false;
  }

  if (fullpage) {
    fullpage.addEventListener('scrollend', () => {
      if (isTransitioning) {
        releaseTransition();
      }
    });
  }

  window.addEventListener('scrollend', () => {
    if (isTransitioning && !desktopQuery.matches) {
      releaseTransition();
    }
  });

  function scrollToSection(index) {
    const clamped = Math.max(0, Math.min(totalSections - 1, index));
    const targetSection = sections[clamped];
    if (!targetSection) return;

    // Close mobile menu if open
    if (mainNav && mainNav.classList.contains('is-open')) {
      mainNav.classList.remove('is-open');
      if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
    }

    setActiveSection(clamped);

    isTransitioning = true;
    clearTimeout(transitionTimer);

    if (desktopQuery.matches && fullpage) {
      const targetTop =
        targetSection.getBoundingClientRect().top -
        fullpage.getBoundingClientRect().top +
        fullpage.scrollTop;
      const alreadyThere = Math.abs(fullpage.scrollTop - targetTop) < 2;
      const instant = reducedMotionQuery.matches || alreadyThere;

      transitionTimer = setTimeout(releaseTransition, instant ? 80 : 1000);
      fullpage.scrollTo({
        top: Math.max(0, targetTop),
        behavior: instant ? 'auto' : 'smooth',
      });
    } else {
      const headerOffset = 70;
      const top = targetSection.getBoundingClientRect().top + window.scrollY - headerOffset;
      const clampedTop = Math.max(0, top);
      const alreadyThere = Math.abs(window.scrollY - clampedTop) < 2;
      const instant = reducedMotionQuery.matches || alreadyThere;

      transitionTimer = setTimeout(releaseTransition, instant ? 80 : 1000);
      window.scrollTo({
        top: clampedTop,
        behavior: instant ? 'auto' : 'smooth',
      });
    }
  }

  gotoTriggers.forEach((el) => {
    el.addEventListener('click', (event) => {
      const targetAttr = el.dataset.goto;
      if (targetAttr === undefined) return;
      event.preventDefault();
      scrollToSection(Number(targetAttr));
    });
  });

  /* ------------------------------------------------------------------------
     IntersectionObserver for Active Section Detection
     ------------------------------------------------------------------------ */
  let observer = null;

  function setupObserver() {
    if (observer) {
      observer.disconnect();
    }

    const useContainerRoot = desktopQuery.matches && fullpage;
    observer = new IntersectionObserver(
      (entries) => {
        if (isTransitioning) return;

        let bestEntry = null;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!bestEntry || entry.intersectionRatio > bestEntry.intersectionRatio) {
              bestEntry = entry;
            }
          }
        });

        if (bestEntry) {
          const idx = Number(bestEntry.target.dataset.sectionIndex);
          if (!Number.isNaN(idx) && idx !== currentIndex) {
            setActiveSection(idx);
          }
        }
      },
      {
        root: useContainerRoot ? fullpage : null,
        threshold: [0.35, 0.55, 0.75],
      }
    );

    sections.forEach((sec) => observer.observe(sec));
  }

  setupObserver();
  desktopQuery.addEventListener('change', setupObserver);

  /* ------------------------------------------------------------------------
     Desktop Wheel & Keyboard Navigation
     ------------------------------------------------------------------------ */
  function canSectionScrollInternally(section, deltaY) {
    if (!section) return false;
    const maxScroll = section.scrollHeight - section.clientHeight;
    if (maxScroll <= 4) return false;
    if (deltaY > 0) {
      return section.scrollTop < maxScroll - 4;
    }
    return section.scrollTop > 4;
  }

  if (fullpage) {
    fullpage.addEventListener(
      'wheel',
      (event) => {
        if (!desktopQuery.matches) return;
        if (Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;

        const now = performance.now();
        const gap = now - lastWheelTs;
        lastWheelTs = now;

        // A pause >= 200ms starts a new wheel/trackpad gesture
        if (gap >= 200) {
          gestureConsumed = false;
          wheelAccumulator = 0;
        }

        const activeSection = sections[currentIndex];
        if (canSectionScrollInternally(activeSection, event.deltaY)) {
          wheelAccumulator = 0;
          return;
        }

        event.preventDefault();
        if (isTransitioning || gestureConsumed) return;

        wheelAccumulator += event.deltaY;

        if (Math.abs(wheelAccumulator) >= 28) {
          const direction = wheelAccumulator > 0 ? 1 : -1;
          wheelAccumulator = 0;
          gestureConsumed = true;
          const nextIdx = currentIndex + direction;
          if (nextIdx >= 0 && nextIdx < totalSections) {
            scrollToSection(nextIdx);
          }
        }
      },
      { passive: false }
    );
  }

  document.addEventListener('keydown', (event) => {
    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
      return;
    }

    if (!desktopQuery.matches) return;

    const activeSection = sections[currentIndex];

    if (event.key === 'ArrowDown' || event.key === 'PageDown') {
      if (canSectionScrollInternally(activeSection, 1)) return;
      event.preventDefault();
      if (!isTransitioning && currentIndex < totalSections - 1) {
        scrollToSection(currentIndex + 1);
      }
    } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
      if (canSectionScrollInternally(activeSection, -1)) return;
      event.preventDefault();
      if (!isTransitioning && currentIndex > 0) {
        scrollToSection(currentIndex - 1);
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      scrollToSection(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      scrollToSection(totalSections - 1);
    }
  });

  /* ------------------------------------------------------------------------
     Mobile Header Navigation Toggle
     ------------------------------------------------------------------------ */
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = mainNav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  /* ------------------------------------------------------------------------
     Subtle Synaptic Neural Network Canvas Background
     ------------------------------------------------------------------------ */
  const canvas = document.getElementById('neural-bg');
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    let nodes = [];
    let animFrame = null;
    let width = 0;
    let height = 0;

    function initCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(44, Math.max(18, Math.floor((width * height) / 36000)));
      nodes = Array.from({ length: count }, (_, idx) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: idx % 5 === 0 ? 2.4 : 1.5,
        teal: idx % 4 === 0,
      }));
    }

    function drawFrame() {
      ctx.clearRect(0, 0, width, height);
      const maxDist = 155;

      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        if (!reducedMotionQuery.matches) {
          a.x += a.vx;
          a.y += a.vy;
          if (a.x < 0 || a.x > width) a.vx *= -1;
          if (a.y < 0 || a.y > height) a.vy *= -1;
        }

        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.18;
            ctx.strokeStyle = `rgba(56, 189, 248, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }

        ctx.fillStyle = a.teal
          ? 'rgba(45, 212, 191, 0.42)'
          : 'rgba(96, 165, 250, 0.4)';
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reducedMotionQuery.matches) {
        animFrame = requestAnimationFrame(drawFrame);
      }
    }

    initCanvas();
    drawFrame();

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        cancelAnimationFrame(animFrame);
        initCanvas();
        drawFrame();
      }, 180);
    });
  }

  /* Initialize Active Section state */
  setActiveSection(initialIndex);
  if (window.location.search.includes('canva=1')) {
    if (fullpage) fullpage.scrollTop = 0;
    window.scrollTo(0, 0);
  }
})();
