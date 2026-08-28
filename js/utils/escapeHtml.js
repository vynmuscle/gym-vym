// div.textContent->innerHTML NÃO escapa aspas (só tem sentido dentro de um
// atributo, não em texto solto) -- várias telas interpolam o resultado
// dentro de value="..."/alt="..." (ex: nota do exercício em train.js), então
// aspas sem escapar permitem quebrar pra fora do atributo. Escapa na mão.
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
