// Exporta a comparação (fotos + análises por par + conclusão geral) em PDF,
// gerado no próprio navegador via jsPDF (CDN sob demanda -- mesmo padrão do
// Motion One em js/core/motion.js) -- sem backend novo pra isso.
export async function exportComparisonPdf({ pairs, conclusion }) {
  const { jsPDF } = await import('https://cdn.jsdelivr.net/npm/jspdf@2.5.4/+esm');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageW - margin * 2;
  let y = margin;

  function ensureSpace(needed){
    if(y + needed > pageH - margin){
      doc.addPage();
      y = margin;
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Comparação de fotos - Gym Vym', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(130);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, margin, y);
  doc.setTextColor(0);
  y += 10;

  pairs.forEach((pair, i) => {
    ensureSpace(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(`Pose ${i + 1}`, margin, y);
    y += 7;

    const gap = 6;
    const imgW = (contentW - gap) / 2;
    const olderH = imgW * (pair.olderRatio || 1.33);
    const newerH = imgW * (pair.newerRatio || 1.33);
    const rowH = Math.max(olderH, newerH);

    ensureSpace(rowH + 16);

    doc.addImage(pair.olderBase64, 'JPEG', margin, y, imgW, olderH);
    doc.addImage(pair.newerBase64, 'JPEG', margin + imgW + gap, y, imgW, newerH);
    y += rowH + 3;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(pair.olderLabel, margin, y);
    doc.text(pair.newerLabel, margin + imgW + gap, y);
    doc.setTextColor(0);
    y += 6;

    doc.setFontSize(10);
    const lines = doc.splitTextToSize(pair.analysisText || 'Sem análise.', contentW);
    ensureSpace(lines.length * 5);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 10;
  });

  if(conclusion){
    ensureSpace(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Conclusão geral', margin, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(conclusion, contentW);
    ensureSpace(lines.length * 5);
    doc.text(lines, margin, y);
  }

  doc.save(`gymvym-comparacao-${new Date().toISOString().slice(0, 10)}.pdf`);
}
