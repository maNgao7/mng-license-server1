document.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("portalMenu");
    const navigation = document.getElementById("primaryNavigation");
    if (!button || !navigation) return;
    const close = () => {
        navigation.classList.remove("is-open");
        button.setAttribute("aria-expanded", "false");
    };
    button.addEventListener("click", () => {
        const open = navigation.classList.toggle("is-open");
        button.setAttribute("aria-expanded", String(open));
    });
    navigation.addEventListener("click", event => { if (event.target.closest("a")) close(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape") close(); });
    document.addEventListener("click", event => {
        if (!navigation.contains(event.target) && !button.contains(event.target)) close();
    });
    window.matchMedia("(min-width:1101px)").addEventListener("change", close);
});
