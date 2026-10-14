(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const cards = [...document.querySelectorAll('[data-project-video]')].map(video => {
    const state = { video, visible: false, paused: reducedMotion.matches };
    function sync() {
      const play = state.visible && !state.paused && !document.hidden;
      if (play) {
        if (!video.getAttribute('src')) video.src = video.dataset.src;
        video.muted = true;
        video.play().catch(() => {
          state.paused = true;
        });
      } else video.pause();
    }
    state.sync = sync;
    sync();
    return state;
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const state = cards.find(item => item.video === entry.target);
        state.visible = entry.isIntersecting;
        state.sync();
      });
    }, { threshold: 0.15 });
    cards.forEach(state => observer.observe(state.video));
  } else cards.forEach(state => { state.visible = true; state.sync(); });
  document.addEventListener('visibilitychange', () => cards.forEach(state => state.sync()));
  reducedMotion.addEventListener('change', () => cards.forEach(state => {
    state.paused = reducedMotion.matches;
    state.sync();
  }));
})();
