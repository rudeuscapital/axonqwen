const s=new IntersectionObserver(e=>e.forEach(r=>{r.isIntersecting&&r.target.classList.add("in")}),{threshold:.1});document.querySelectorAll(".reveal").forEach(e=>s.observe(e));
