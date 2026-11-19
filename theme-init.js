(function () {
    try {
        if (localStorage.getItem('ktunTheme') === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        }
    } catch (e) { }
})();
