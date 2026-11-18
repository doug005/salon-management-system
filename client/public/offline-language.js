(() => {
  let language = 'en';
  try { language = localStorage.getItem('salon-language') === 'st' ? 'st' : 'en'; } catch { /* preference is optional */ }
  if (language !== 'st') return;
  document.documentElement.lang = 'st';
  document.title = 'Ha ho inthanete · Salon Management';
  const copy = [
    'O se na inthanete',
    'Khokahanyo ha e fumanehe. App e ka bontša lintlha tsa sechaba tse bolokiloeng haeba e ile ea buloa ka inthanete pele.',
    'Bakeng sa tšireletseho ea hau: lipehelo, ho kena ak'haonteng, liphetoho tsa lipehelo le netefatso ea tefo li hloka inthanete. Ha li bolokoe hore li romeloe hamorao. U se ke ua nahana hore pehelo kapa tefo e netefalitsoe.',
    'Leka hape',
    'Lipehelo tsa hau le lirekoto tsa lichelete ha li bolokoe polokelong e arolelanoang ha ho se inthanete.',
  ];
  const targets = document.querySelectorAll('h1, main > p, .notice, button, main > p:last-child');
  targets.forEach((element, index) => {
    if (copy[index]) element.textContent = copy[index];
  });
})();
