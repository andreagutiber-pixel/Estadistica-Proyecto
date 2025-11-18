// ===================================
// CONFIGURACIÓN INICIAL
// ===================================
const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
});

let datosActualesGlobal = {};
let chartBarras = null;
let chartPastel = null;
// Se elimina chartBoxplot
// let chartBoxplot = null;

// ===================================
// MÓDULO ESTADÍSTICA (LÓGICA PURA)
// ===================================
const Estadistica = {
    esNumero: (valor) => !isNaN(parseFloat(valor)) && isFinite(valor),

    media: (datos) => {
        const suma = datos.reduce((acc, val) => acc + val, 0);
        return suma / datos.length;
    },

    mediana: (datos) => {
        const ordenados = [...datos].sort((a, b) => a - b);
        const mid = Math.floor(ordenados.length / 2);
        if (ordenados.length % 2 !== 0) return ordenados[mid];
        return (ordenados[mid - 1] + ordenados[mid]) / 2;
    },

    moda: (datos, tipoDato = 'cuantitativo') => {
        const frecuencia = {};
        datos.forEach(val => frecuencia[val] = (frecuencia[val] || 0) + 1);

        const frecArray = Object.entries(frecuencia).map(([val, frec]) => ({
            valor: val,
            frecuencia: frec
        }));

        if (frecArray.length === 0) {
            return { tipo: 'amodal', valor: 'N/A', modas: [], frecuencia: 0 };
        }

        frecArray.sort((a, b) => b.frecuencia - a.frecuencia);
        const maxFrec = frecArray[0].frecuencia;

        if (maxFrec === 1 && frecArray.length === datos.length) {
            return { tipo: 'amodal', valor: 'Amodal', modas: [], frecuencia: 1 };
        }

        const modas = frecArray
            .filter(item => item.frecuencia === maxFrec)
            .map(item => tipoDato === 'cuantitativo' ? Number(item.valor) : item.valor);

        if (tipoDato === 'cuantitativo') modas.sort((a, b) => a - b);

        if (modas.length === frecArray.length) {
            return { tipo: 'amodal', valor: 'Amodal', modas: [], frecuencia: maxFrec };
        }

        if (modas.length === 1) {
            return { tipo: 'unimodal', valor: String(modas[0]), modas: modas, frecuencia: maxFrec };
        }

        if (modas.length > 3) {
            return { tipo: 'multimodal', valor: 'Multimodal', modas: modas, frecuencia: maxFrec };
        }

        return { tipo: 'multimodal', valor: modas.join(', '), modas: modas, frecuencia: maxFrec };
    },

    rango: (datos) => Math.max(...datos) - Math.min(...datos),

    varianza: (datos, media, esPoblacion = false) => {
        if (datos.length < 2) return 0;
        const sum = datos.reduce((acc, val) => acc + Math.pow(val - media, 2), 0);
        const divisor = esPoblacion ? datos.length : datos.length - 1;
        return sum / divisor;
    },

    desviacion: (varianza) => Math.sqrt(varianza),

    analisisOrdinal: (datosTexto) => {
        const datosLimp = datosTexto.map(d => d.toLowerCase().trim());
        const datosUnicos = [...new Set(datosLimp)];

        const escalasConocidas = [
            ['pesimo', 'malo', 'regular', 'bueno', 'excelente'],
            ['muy insatisfecho', 'insatisfecho', 'neutral', 'satisfecho', 'muy satisfecho'],
            ['totalmente en desacuerdo', 'en desacuerdo', 'neutral', 'de acuerdo', 'totalmente de acuerdo'],
            ['malo', 'regular', 'bueno'],
            ['bajo', 'medio', 'alto'],
            ['nunca', 'rara vez', 'a veces', 'frecuentemente', 'siempre'],
            ['xs', 's', 'm', 'l', 'xl', 'xxl'],
            ['primaria', 'secundaria', 'tecnico', 'pregrado', 'posgrado', 'doctorado'],
        ];

        let escalaEncontrada = null;

        for (const escala of escalasConocidas) {
            const todosPertenecen = datosUnicos.every(dato => escala.includes(dato));
            if (todosPertenecen && datosUnicos.length > 1) {
                escalaEncontrada = escala;
                break;
            }
        }

        if (!escalaEncontrada) return null;

        const datosNumericos = datosLimp.map(val => escalaEncontrada.indexOf(val));
        datosNumericos.sort((a, b) => a - b);

        const mid = Math.floor(datosNumericos.length / 2);
        const indiceMediana = datosNumericos.length % 2 !== 0 
            ? datosNumericos[mid] 
            : datosNumericos[mid];

        const palabraMediana = escalaEncontrada[indiceMediana];

        return {
            tipo: 'Ordinal',
            mediana: palabraMediana.charAt(0).toUpperCase() + palabraMediana.slice(1)
        };
    },

    tablaFrecuencias: (datos, esCuantitativa) => {
        const n = datos.length;
        const map = {};
        datos.forEach(x => map[x] = (map[x] || 0) + 1);

        let unicos = Object.keys(map);
        if (esCuantitativa) {
            unicos = unicos.map(Number).sort((a, b) => a - b);
        } else {
            unicos = unicos.sort((a, b) => map[b] - map[a]);
        }

        let Fi = 0;
        let tabla = [];
        unicos.forEach(x => {
            let fi = map[x];
            Fi += fi;
            // Redondeo a 3 decimales
            let hi = (fi / n).toFixed(3);
            let Hi = (Fi / n).toFixed(3);
            // Redondeo a 1 decimal
            let pi = (parseFloat(hi) * 100).toFixed(1); 
            tabla.push({ x, fi, Fi, hi, Hi, pi });
        });
        return tabla;
    },

    // La función generarPasoPaso se mantiene internamente, pero ya no se llama desde fuera
    generarPasoPaso: (tipo, datos, resultado, extra = null, esPoblacion = false) => {
        if ((!datos || datos.length === 0) && tipo !== 'cv' && tipo !== 'desviacion') {
            return `No hay datos para el paso a paso.`;
        }

        const n = datos ? datos.length : 0;

        switch(tipo) {
            case 'media':
                const suma = datos.reduce((a,b)=>a+b,0);
                return `$$ \\bar{x} = \\frac{${suma}}{${n}} = ${resultado} $$`;

            case 'varianza':
                const mediaVar = extra;
                const datosMuestra = datos.slice(0, 6);
                let terminos = datosMuestra.map(d => `(${d} - ${mediaVar})^2`).join(" + ");
                if (datos.length > 6) terminos += " + ...";
                const denom = esPoblacion ? n : `${n} - 1`;
                return `$$ s^2 = \\frac{${terminos}}{${denom}} = ${resultado} $$`;

            case 'desviacion':
                return `$$ s = \\sqrt{${extra}} = ${resultado} $$`;

            case 'mediana':
                const ordenados = [...datos].sort((a, b) => a - b);
                return `$$ \\text{Ordenados: } [${ordenados.slice(0,10).join(", ")}${ordenados.length>10?'...':''}] \\rightarrow ${resultado} $$`;

            case 'moda':
                const conteo = {};
                datos.forEach(x => conteo[x] = (conteo[x] || 0) + 1);
                let maxFrec = Math.max(...Object.values(conteo));
                let textoConteo = Object.entries(conteo)
                    .map(([num, cant]) => cant === maxFrec && cant > 1 
                        ? `\\mathbf{\\color{orange}{${num}(${cant})}}` 
                        : `${num}(${cant})`)
                    .join(", ");
                return `$$ \\text{Frecuencias: } [${textoConteo}] \\rightarrow ${resultado} $$`;

            case 'cv':
                const { desv, media } = extra;
                return `$$ CV = \\frac{${desv}}{${media}} \\times 100 = ${resultado}\\% $$`;

            default: return "";
        }
    }
};

// ===================================
// PROCESAMIENTO PRINCIPAL
// ===================================
async function procesarDatos(modoAutomatico = false) {
    const textoRaw = document.getElementById('datosInput').value.trim();
    
    if (!textoRaw) {
        Toast.fire({ icon: 'error', title: 'No hay datos para analizar' });
        return;
    }

    let datosPre = textoRaw.split(/[,;\n]+/).map(val => val.trim()).filter(val => val !== "");
    
    if (datosPre.length === 0) {
        Toast.fire({ icon: 'error', title: 'Datos inválidos' });
        return;
    }

    let datosCrudos = [];
    const muestra = datosPre[0];
    const empiezaConNumero = /^-?\d/.test(muestra);
    const tieneEspacios = muestra.includes(' ');

    if (empiezaConNumero && tieneEspacios) {
        datosCrudos = textoRaw.split(/[\s,;\n]+/).map(val => val.trim()).filter(val => val !== "");
    } else {
        datosCrudos = datosPre;
    }

    let conteoNumeros = 0;
    datosCrudos.forEach(d => {
        if (Estadistica.esNumero(d)) conteoNumeros++;
    });
    const esCuantitativaDetectada = (conteoNumeros / datosCrudos.length) > 0.9;
    
    let esCuantitativa = esCuantitativaDetectada; 

    const tipoDato = document.getElementById('tipoDato').value;
    const esPoblacion = tipoDato === 'poblacional';
    const tipoDatoFinal = esCuantitativa ? 'cuantitativo' : 'cualitativo';

    let media, mediana, rango, varianza, desviacion, coefVariacion;
    let mediaStr, medianaStr, modaStr, rangoStr, varianzaStr, desviacionStr, cvStr;
    let tabla;
    let datosParaGraficos = [];
    let datosParaAyuda = [];
    let tipoBadge = '';
    let interpretacion = '';

    if (esCuantitativa) {
        const datosNum = datosCrudos.map(num => parseFloat(num)).filter(num => !isNaN(num));
        datosParaGraficos = datosNum;
        datosParaAyuda = datosNum;

        const esDiscreto = datosNum.every(num => Number.isInteger(num));
        tipoBadge = esDiscreto 
            ? '<span class="badge badge-cuantitativo">Cuantitativa Discreta</span>'
            : '<span class="badge badge-cuantitativo">Cuantitativa Continua</span>';

        media = Estadistica.media(datosNum);
        mediana = Estadistica.mediana(datosNum);
        const modaObj = Estadistica.moda(datosNum, tipoDatoFinal);
        rango = Estadistica.rango(datosNum);
        varianza = Estadistica.varianza(datosNum, media, esPoblacion);
        desviacion = Estadistica.desviacion(varianza);
        coefVariacion = media !== 0 ? (desviacion / media) * 100 : 0;
        tabla = Estadistica.tablaFrecuencias(datosNum, true);

        // Los resultados estadísticos (no de la tabla) mantienen 2 decimales
        mediaStr = media.toFixed(2);
        medianaStr = mediana.toFixed(2);
        modaStr = modaObj.valor;
        rangoStr = rango.toFixed(2);
        varianzaStr = varianza.toFixed(2);
        desviacionStr = desviacion.toFixed(2);
        cvStr = coefVariacion.toFixed(2) + '%';

        // Interpretación Cuantitativa simplificada
        interpretacion = `
            <strong>📊 Análisis Automático:</strong><br>
            Se analizaron <strong>${datosNum.length} datos numéricos</strong>. 
            El promedio es <strong>${mediaStr}</strong>.
            El coeficiente de variación es del <strong>${cvStr}</strong>.
            Los datos varían en un rango de <strong>${rangoStr}</strong> unidades.
        `;

        datosActualesGlobal = {
            datos: datosNum,
            media, mediana, rango, varianza, desviacion,
            moda: modaStr
        };

    } else {
        const datosTexto = datosCrudos;
        datosParaAyuda = datosTexto;
        tabla = Estadistica.tablaFrecuencias(datosTexto, false);
        const modaObj = Estadistica.moda(datosTexto, tipoDatoFinal);
        
        const resultadoOrdinal = Estadistica.analisisOrdinal(datosTexto);

        if (resultadoOrdinal) {
            tipoBadge = '<span class="badge badge-ordinal">Cualitativa Ordinal</span>';
            medianaStr = resultadoOrdinal.mediana;
            mediana = resultadoOrdinal.mediana;
        } else {
            tipoBadge = '<span class="badge badge-cualitativo">Cualitativa Nominal</span>';
            medianaStr = "--";
            mediana = null;
        }

        const topCat = tabla[0];
        
        // Interpretación Cualitativa simplificada
        interpretacion = `
            <strong>📝 Análisis Automático:</strong><br>
            Se analizaron <strong>${tabla.length} categorías</strong> diferentes.
        `;
        if (topCat && tabla.length > 1 && topCat.fi !== tabla[tabla.length - 1].fi) {
             interpretacion += `<br>La categoría predominante es <strong>"${topCat.x}"</strong> con ${topCat.pi}%.`;
        }

        mediaStr = rangoStr = varianzaStr = desviacionStr = cvStr = "--";
        modaStr = modaObj.valor;

        datosActualesGlobal = {
            datos: datosTexto,
            media: null, mediana, rango: null, varianza: null, desviacion: null,
            moda: modaStr
        };
    }

    mostrarResultados(mediaStr, medianaStr, modaStr, rangoStr, varianzaStr, desviacionStr, cvStr, tipoBadge, esPoblacion);
    mostrarTablaFrecuencias(tabla);
    generarGraficos(tabla, datosParaGraficos, esCuantitativa);
    
    const analisisBox = document.getElementById('analisisInteligente');
    if (analisisBox) {
        analisisBox.innerHTML = interpretacion;
        analisisBox.style.display = 'block';
        analisisBox.classList.add('fade-in');
    }

    if (!modoAutomatico) {
        Toast.fire({ 
            icon: 'success', 
            title: esCuantitativa ? 'Análisis Numérico Completo ✓' : 'Análisis Cualitativo Completo ✓' 
        });
    }
}

// ===================================
// MOSTRAR RESULTADOS
// ===================================
function mostrarResultados(media, mediana, moda, rango, varianza, desviacion, cv, badge, esPoblacion) {
    const metodoCalculo = esPoblacion ? 'Método Poblacional' : 'Método Muestral';
    
    const html = `
        <div style="margin-bottom:16px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            ${badge}
            <span class="badge" style="background:#e8f5e9; color:#2e7d32;">
                ${metodoCalculo}
            </span>
        </div>
        
        <div style="display:grid; gap:8px;">
            <p><strong>Promedio:</strong> ${media} </p>
            <p><strong>Mediana:</strong> ${mediana}</p>
            <p><strong>Moda:</strong> ${moda}</p>
            <p><strong>Rango:</strong> ${rango}</p>
            <p><strong>Varianza:</strong> ${varianza}</p>
            <p><strong>Desviación Estándar:</strong> ${desviacion}</p>
            <p><strong>Coef. Variación:</strong> ${cv}</p>
        </div>
    `;
    
    const resultadosEl = document.getElementById('resultados');
    if (resultadosEl) {
        resultadosEl.innerHTML = html;
        resultadosEl.classList.add('fade-in');
    }
}

// ===================================
// MOSTRAR TABLA DE FRECUENCIAS
// ===================================
function mostrarTablaFrecuencias(tabla) {
    const tablaEl = document.getElementById('tablaFrecuencias');
    if (!tablaEl) return;

    if (!tabla || tabla.length === 0) {
        tablaEl.innerHTML = '<p style="color:var(--muted);">No hay datos para mostrar</p>';
        return;
    }

    let sumaFi = 0, sumaHi = 0, sumaPi = 0;
    const lastHi = tabla[tabla.length - 1].Hi;

    let html = `
        <table>
            <thead>
                <tr>
                    <th>Valor</th>
                    <th>fi (Frecuencia)</th>
                    <th>Fi (Acumulada)</th>
                    <th>hi (Relativa)</th>
                    <th>Hi (Rel. Acumulada)</th>
                    <th>% (Porcentaje)</th>
                </tr>
            </thead>
            <tbody>
    `;

    tabla.forEach(fila => {
        sumaFi += parseFloat(fila.fi);
        // Usamos el valor original para la suma total, no el string redondeado
        sumaHi += parseFloat(fila.fi) / datosActualesGlobal.datos.length; 
        sumaPi += parseFloat(fila.pi); // Aunque esta suma es menos precisa debido al redondeo en pi

        html += `
            <tr>
                <td><strong>${fila.x}</strong></td>
                <td>${fila.fi}</td>
                <td>${fila.Fi}</td>
                <td>${fila.hi}</td>
                <td>${fila.Hi}</td>
                <td>${fila.pi}%</td>
            </tr>
        `;
    });

    html += `
        <tr style="background:rgba(25,118,210,0.08); font-weight:700;">
            <td>TOTAL</td>
            <td>${sumaFi}</td>
            <td>--</td>
            <td>${sumaHi.toFixed(3)}</td> <td>${lastHi}</td>
            <td>${sumaPi.toFixed(1)}%</td> </tr>
    `;

    html += `</tbody></table>`;
    tablaEl.innerHTML = html;
    tablaEl.classList.add('fade-in');
}

// ===================================
// GENERAR GRÁFICOS
// ===================================
function generarGraficos(tabla, datosRaw = [], esCuantitativa) {
    const labels = tabla.map(t => String(t.x));
    const dataFi = tabla.map(t => Number(t.fi));
    const dataPi = tabla.map(t => Number(t.pi));

    // Colores base definidos por el usuario
    const mainColor = '#1A360D'; // linea de la grafica (Texto principal)
    const pastelColors = ['#71AABD', '#42921D', '#24CB80', '#71AABD']; // Gráficas de pastel (Ajuste de repetición)

    const isDark = document.body.classList.contains('noche');
    // Usamos el color de texto principal del tema, ya que el fondo es claro
    const textColor = isDark ? '#1A360D' : '#1A360D'; 
    const gridColor = 'rgba(26,54,13,0.1)'; // Líneas de grid muy sutiles

    if (chartBarras) chartBarras.destroy();
    if (chartPastel) chartPastel.destroy();
    // if (chartBoxplot) chartBoxplot.destroy(); <-- Eliminado

    const ctxBarras = document.getElementById('graficoBarras');
    if (ctxBarras) {
        chartBarras = new Chart(ctxBarras.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Frecuencia',
                    data: dataFi,
                    // Color de barra principal ajustado al tema
                    backgroundColor: 'rgba(64, 104, 104, 0.8)', 
                    borderColor: '#406868',
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    datalabels: { display: false }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        ticks: { color: textColor },
                        grid: { color: gridColor }
                    },
                    x: {
                        ticks: { color: textColor },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    const ctxPastel = document.getElementById('graficoPastel');
    if (ctxPastel) {
        // Asignación de colores de pastel
        const backgroundColors = dataPi.map((_, i) => pastelColors[i % pastelColors.length]);

        chartPastel = new Chart(ctxPastel.getContext('2d'), {
            type: 'pie', // <-- CAMBIADO de 'doughnut' a 'pie' (completo)
            data: {
                labels: labels,
                datasets: [{
                    data: dataPi,
                    backgroundColor: backgroundColors,
                    borderWidth: 2,
                    borderColor: '#F7F4EA' // Borde claro de la tabla inferior
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { 
                            color: textColor,
                            boxWidth: 15,
                            padding: 10
                        }
                    },
                    datalabels: { display: false }
                }
            }
        });
    }

    // ELIMINACIÓN DE LA LÓGICA DEL DIAGRAMA DE CAJA (BOXPLOT)
    // Se elimina todo el bloque 'if (esCuantitativa && datosRaw.length > 0 && boxplotCard)'
    // ya que la tarjeta fue eliminada de index.html y la variable chartBoxplot ya no existe.

    const graficasEl = document.getElementById('graficas');
    if (graficasEl) {
        graficasEl.style.display = 'block';
        graficasEl.classList.add('fade-in');
    }
}

// ===================================
// EXPORTAR A EXCEL
// ===================================
function exportarExcel() {
    const datosInputEl = document.getElementById('datosInput');
    if (!datosInputEl) return;
    
    const datos = datosInputEl.value.trim();
    if (!datos) {
        Toast.fire({ icon: 'warning', title: 'No hay datos para exportar' });
        return;
    }

    if (typeof XLSX === 'undefined') {
        Toast.fire({ icon: 'error', title: 'Librería XLSX no cargada' });
        return;
    }

    const wb = XLSX.utils.book_new();
    const wsData = [
        ['Analizador Estadístico Profesional'],
        [''],
        ['Datos Originales:'],
        [datos],
        [''],
        ['Resultados:'],
    ];

    const resultadosDiv = document.getElementById('resultados');
    if (resultadosDiv) {
        const lineas = resultadosDiv.innerText.split('\n').filter(l => l.trim());
        lineas.forEach(linea => wsData.push([linea]));
    }

    wsData.push(['']);
    wsData.push(['Tabla de Frecuencias:']);

    const tabla = document.querySelector('#tablaFrecuencias table');
    if (tabla) {
        const rows = tabla.querySelectorAll('tr');
        rows.forEach(row => {
            const cols = row.querySelectorAll('th, td');
            const rowData = [];
            cols.forEach(col => rowData.push(col.innerText));
            wsData.push(rowData);
        });
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
    XLSX.writeFile(wb, 'analisis_estadistico.xlsx');
    Toast.fire({ icon: 'success', title: 'Excel descargado correctamente' });
}

// ===================================
// EXPORTAR A PDF
// ===================================
async function exportarPDF() {
    const datosInputEl = document.getElementById('datosInput');
    if (!datosInputEl) return;
    
    const datos = datosInputEl.value.trim();
    if (!datos) {
        Toast.fire({ icon: 'warning', title: 'No hay datos para exportar' });
        return;
    }

    if (typeof window.jspdf === 'undefined') {
        Toast.fire({ icon: 'error', title: 'Librería jsPDF no cargada' });
        return;
    }

    Toast.fire({ icon: 'info', title: 'Generando PDF...' });

    const isDark = document.body.classList.contains('noche');
    const chartsActivos = [chartBarras, chartPastel].filter(c => c); // Se elimina chartBoxplot

    const setChartPrintColors = (chart, colorText = '#000000', colorGrid = 'rgba(0,0,0,0.3)') => {
        if (!chart || !chart.options) return;
        
        chart.options.color = colorText;
        if (chart.options.scales) {
            Object.keys(chart.options.scales).forEach(key => {
                const scale = chart.options.scales[key];
                if (scale.ticks) scale.ticks.color = colorText;
                if (scale.grid) {
                    scale.grid.color = colorGrid;
                    scale.grid.borderColor = colorText;
                }
            });
        }
        if (chart.options.plugins?.legend?.labels) {
            chart.options.plugins.legend.labels.color = colorText;
        }
        chart.update('none');
    };

    try {
        chartsActivos.forEach(c => setChartPrintColors(c));
        await new Promise(resolve => setTimeout(resolve, 500));

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        let currentY = 15;

        doc.setFillColor(25, 118, 210);
        doc.rect(0, 0, pageWidth, 8, 'F');
        currentY += 12;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.setTextColor(25, 118, 210);
        doc.text("Informe Estadístico Profesional", margin, currentY);
        currentY += 8;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text("Proyecto: Jhonar De Arco, Sally Gutiérrez & Martin Solano", margin, currentY);
        doc.text(`Fecha: ${new Date().toLocaleString()}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 10;

        doc.setDrawColor(200);
        doc.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 10;

        const tipoDatoEl = document.getElementById('tipoDato');
        const tipoDato = tipoDatoEl ? tipoDatoEl.value : 'muestral';
        const metodo = tipoDato === 'poblacional' ? 'Poblacional (N)' : 'Muestral (n-1)';
        
        doc.setFillColor(245, 250, 255);
        doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 25, 3, 3, 'F');
        
        doc.setFontSize(11);
        doc.setTextColor(25, 118, 210);
        doc.setFont("helvetica", "bold");
        doc.text("Metodología de Cálculo", margin + 5, currentY + 8);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(60);
        doc.text(`Método: ${metodo}`, margin + 5, currentY + 15);
        
        const analisisEl = document.getElementById('analisisInteligente');
        const analisisTexto = analisisEl ? analisisEl.innerText : 'No disponible';
        const splitTexto = doc.splitTextToSize(analisisTexto, pageWidth - (margin * 2) - 10);
        doc.text(splitTexto, margin + 5, currentY + 20);
        
        currentY += 35;

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Resultados Estadísticos", margin, currentY);
        currentY += 5;

        const resultadosDiv = document.getElementById('resultados');
        if (resultadosDiv) {
            const lineas = resultadosDiv.innerText.split('\n').filter(l => l.trim() && !l.includes('?'));
            const resultadosData = [];
            
            // Asumiendo que el formato sigue siendo "Clave: Valor"
            lineas.forEach(line => {
                const parts = line.split(':');
                if (parts.length > 1) {
                    resultadosData.push([parts[0].trim(), parts[1].trim()]);
                }
            });


            if (typeof doc.autoTable === 'function') {
                doc.autoTable({
                    startY: currentY,
                    head: [['Medida', 'Valor']],
                    body: resultadosData.length > 0 ? resultadosData : [['Media', '--'], ['Mediana', '--']],
                    theme: 'grid',
                    headStyles: { 
                        fillColor: [25, 118, 210], 
                        textColor: 255, 
                        fontStyle: 'bold',
                        halign: 'center'
                    },
                    styles: { fontSize: 9, cellPadding: 3 },
                    columnStyles: {
                        0: { fontStyle: 'bold', textColor: [30, 41, 59] },
                        1: { halign: 'center' }
                    }
                });
                currentY = doc.lastAutoTable.finalY + 15;
            }
        }

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Tabla de Frecuencias", margin, currentY);
        currentY += 3;

        const tabla = document.querySelector('#tablaFrecuencias table');
        if (tabla && typeof doc.autoTable === 'function') {
            doc.autoTable({
                html: tabla,
                startY: currentY,
                theme: 'grid',
                headStyles: { 
                    fillColor: [25, 118, 210], 
                    textColor: 255, 
                    halign: 'center',
                    fontStyle: 'bold'
                },
                styles: { fontSize: 8, halign: 'center', cellPadding: 2 },
                alternateRowStyles: { fillColor: [249, 250, 251] }
            });
            currentY = doc.lastAutoTable.finalY + 15;
        }

        const agregarGrafico = (canvasId, titulo) => {
            const canvas = document.getElementById(canvasId);
            if (canvas && canvas.width > 0) {
                if (currentY + 80 > 280) {
                    doc.addPage();
                    currentY = 20;
                }

                doc.setFontSize(11);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(30, 41, 59);
                doc.text(titulo, margin, currentY);

                const scale = 2;
                const tempCanvas = document.createElement("canvas");
                tempCanvas.width = canvas.width * scale;
                tempCanvas.height = canvas.height * scale;
                const ctx = tempCanvas.getContext("2d");

                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);

                const imgData = tempCanvas.toDataURL("image/jpeg", 0.95);
                const imgProps = doc.getImageProperties(imgData);
                const pdfWidth = pageWidth - (margin * 2);
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

                doc.addImage(imgData, 'JPEG', margin, currentY + 5, pdfWidth, pdfHeight);
                tempCanvas.remove();
                currentY += pdfHeight + 20;
            }
        };

        if (chartBarras) agregarGrafico('graficoBarras', '1. Gráfico de Barras');
        if (chartPastel) agregarGrafico('graficoPastel', '2. Gráfico Circular');
        
        // Se elimina la llamada a agregarGrafico para Boxplot

        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
                `Página ${i} de ${pageCount} - Generado por Analizador Estadístico Profesional`, 
                pageWidth / 2, 
                290, 
                { align: 'center' }
            );
        }

        doc.save('informe_estadistico.pdf');
        Toast.fire({ icon: 'success', title: '¡PDF descargado correctamente!' });

    } catch (error) {
        console.error(error);
        Toast.fire({ icon: 'error', title: 'Error al generar PDF' });
    } finally {
        const textColor = isDark ? '#e6eef8' : '#0f172a';
        const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        chartsActivos.forEach(c => setChartPrintColors(c, textColor, gridColor));
    }
}

// ===================================
// GENERADOR DE DATOS ALEATORIOS
// ===================================
function generarDatosDemo() {
    const generadores = {
        nominal: [
            () => {
                const items = ['Manzana', 'Pera', 'Banano', 'Uva', 'Naranja', 'Sandía', 'Mango'];
                return Array.from({ length: 30 }, () => items[Math.floor(Math.random() * items.length)]);
            },
            () => {
                const items = ['Rojo', 'Azul', 'Verde', 'Amarillo', 'Naranja', 'Morado', 'Rosa'];
                return Array.from({ length: 30 }, () => items[Math.floor(Math.random() * items.length)]);
            }
        ],
        ordinal: [
            () => {
                const items = ['Muy Insatisfecho', 'Insatisfecho', 'Neutral', 'Satisfecho', 'Muy Satisfecho'];
                return Array.from({ length: 30 }, () => items[Math.floor(Math.random() * items.length)]);
            },
            () => {
                const items = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
                return Array.from({ length: 35 }, () => items[Math.floor(Math.random() * items.length)]);
            },
            () => {
                const items = ['Malo', 'Regular', 'Bueno'];
                return Array.from({ length: 25 }, () => items[Math.floor(Math.random() * items.length)]);
            }
        ],
        discreta: [
            () => {
                return Array.from({ length: 40 }, () => Math.floor(Math.random() * 6));
            },
            () => {
                return Array.from({ length: 50 }, () => Math.floor(Math.random() * (25 - 17 + 1) + 17));
            }
        ],
        continua: [
            () => {
                return Array.from({ length: 30 }, () => (Math.random() * (1.95 - 1.50) + 1.50).toFixed(2));
            },
            () => {
                return Array.from({ length: 35 }, () => (Math.random() * 5.0).toFixed(1));
            },
            () => {
                return Array.from({ length: 25 }, () => (Math.random() * (40.0 - 35.0) + 35.0).toFixed(1));
            }
        ]
    };

    const categorias = ['nominal', 'ordinal', 'discreta', 'continua'];
    const categoriaElegida = categorias[Math.floor(Math.random() * categorias.length)];
    const opcionesDisponibles = generadores[categoriaElegida];
    const generadorSeleccionado = opcionesDisponibles[Math.floor(Math.random() * opcionesDisponibles.length)];
    const datosNuevos = generadorSeleccionado();

    const datosInputEl = document.getElementById('datosInput');
    if (datosInputEl) {
        datosInputEl.value = datosNuevos.join(', ');
    }

    const mensajes = {
        'nominal': '🎲 Datos Nominales Generados',
        'ordinal': '📊 Datos Ordinales Generados',
        'discreta': '🔢 Datos Discretos Generados',
        'continua': '📏 Datos Continuos Generados'
    };

    Toast.fire({ icon: 'success', title: mensajes[categoriaElegida] });
}

// ===================================
// IMPORTAR ARCHIVOS
// ===================================
function procesarArchivo(file) {
    if (!file) return;

    const nombre = file.name.toLowerCase();

    // Se mantiene la lógica de importación, pero se elimina la referencia a Sesion.restaurar
    if (nombre.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                // Si el JSON contiene datos y configuración, se cargan al input.
                if (json.datos && json.config) { 
                    const datosInputEl = document.getElementById('datosInput');
                    const tipoDatoEl = document.getElementById('tipoDato');
                    
                    if (datosInputEl) datosInputEl.value = json.datos;
                    if (tipoDatoEl) tipoDatoEl.value = json.config;
                    
                    setTimeout(() => {
                        procesarDatos(true);
                        Toast.fire({ icon: 'success', title: 'Datos cargados desde archivo' });
                    }, 50);
                } else {
                    Toast.fire({ icon: 'error', title: 'Formato JSON inválido' });
                }
            } catch (error) {
                Toast.fire({ icon: 'error', title: 'Error al leer JSON' });
            }
        };
        reader.readAsText(file);
        return;
    }

    if (nombre.endsWith('.xlsx') || nombre.endsWith('.xls')) {
        if (typeof XLSX === 'undefined') {
            Toast.fire({ icon: 'error', title: 'Librería XLSX no cargada' });
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const primeraHoja = workbook.SheetNames[0];
                const hoja = workbook.Sheets[primeraHoja];
                const datosJson = XLSX.utils.sheet_to_json(hoja, { header: 1 });
                const listaPlana = datosJson.flat().filter(v => v !== null && v !== '').join(", ");
                
                const datosInputEl = document.getElementById('datosInput');
                if (datosInputEl) datosInputEl.value = listaPlana;
                
                Toast.fire({ icon: 'success', title: 'Excel importado correctamente' });
            } catch (error) {
                Toast.fire({ icon: 'error', title: 'Error al leer Excel' });
            }
        };
        reader.readAsArrayBuffer(file);
        return;
    }

    if (nombre.endsWith('.txt') || nombre.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const datosInputEl = document.getElementById('datosInput');
            if (datosInputEl) datosInputEl.value = e.target.result;
            Toast.fire({ icon: 'success', title: 'Archivo importado correctamente' });
        };
        reader.readAsText(file);
        return;
    }

    Toast.fire({ icon: 'warning', title: 'Formato de archivo no soportado' });
}

// ===================================
// LIMPIAR DATOS
// ===================================
function limpiarDatos() {
    Swal.fire({
        title: '¿Estás seguro?',
        text: 'Se borrarán todos los datos y resultados actuales',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, limpiar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d32f2f',
        cancelButtonColor: '#6b7280'
    }).then((result) => {
        if (result.isConfirmed) {
            const datosInputEl = document.getElementById('datosInput');
            const resultadosEl = document.getElementById('resultados');
            const tablaEl = document.getElementById('tablaFrecuencias');
            const graficasEl = document.getElementById('graficas');
            const analisisEl = document.getElementById('analisisInteligente');
            
            if (datosInputEl) datosInputEl.value = '';
            if (resultadosEl) resultadosEl.innerHTML = '<p style="color:var(--muted); font-style:italic;">Ingresa datos y presiona "Analizar Datos" para ver los resultados...</p>';
            if (tablaEl) tablaEl.innerHTML = '<p style="color:var(--muted); font-style:italic;">La tabla aparecerá después del análisis...</p>';
            if (graficasEl) graficasEl.style.display = 'none';
            if (analisisEl) analisisEl.style.display = 'none';
            
            if (chartBarras) chartBarras.destroy();
            if (chartPastel) chartPastel.destroy();
            // if (chartBoxplot) chartBoxplot.destroy(); <-- Eliminado
            
            chartBarras = null;
            chartPastel = null;
            // chartBoxplot = null; <-- Eliminado
            
            Toast.fire({ icon: 'success', title: 'Datos limpiados' });
        }
    });
}

// ===================================
// MODO NOCHE
// ===================================
function toggleModoNoche() {
    document.body.classList.toggle('noche');
    const btn = document.getElementById('modoNoche');
    const isNoche = document.body.classList.contains('noche');
    
    if (btn) {
        btn.textContent = isNoche ? '☀️ Modo día' : '🌙 Modo noche';
        btn.setAttribute('aria-pressed', isNoche);
    }
    
    localStorage.setItem('modo-noche', isNoche);

    const chartsToUpdate = [chartBarras, chartPastel].filter(c => c); // Se elimina chartBoxplot
    
    if (chartsToUpdate.length > 0) {
        const textColor = isNoche ? '#1A360D' : '#1A360D';
        const gridColor = 'rgba(26,54,13,0.1)';

        chartsToUpdate.forEach(chart => {
            if (!chart) return;
            
            if (chart.options.scales) {
                Object.keys(chart.options.scales).forEach(key => {
                    if (chart.options.scales[key].ticks) {
                        chart.options.scales[key].ticks.color = textColor;
                    }
                    if (chart.options.scales[key].grid) {
                        chart.options.scales[key].grid.color = gridColor;
                    }
                });
            }
            
            if (chart.options.plugins?.legend?.labels) {
                chart.options.plugins.legend.labels.color = textColor;
            }
            
            chart.update();
        });
    }
}

// ===================================
// EVENTOS DEL DOM
// ===================================
document.addEventListener('DOMContentLoaded', () => {
    // Modo noche inicial
    if (localStorage.getItem('modo-noche') === 'true') {
        document.body.classList.add('noche');
        const modoNocheBtn = document.getElementById('modoNoche');
        if (modoNocheBtn) modoNocheBtn.textContent = '☀️ Modo día';
    }

    // Botones principales
    const procesarBtn = document.getElementById('procesarBtn');
    const limpiarBtn = document.getElementById('limpiarBtn');
    const excelBtn = document.getElementById('excelBtn');
    const pdfBtn = document.getElementById('pdfBtn');
    const modoNocheBtn = document.getElementById('modoNoche');
    const demoBtn = document.getElementById('demoBtn');

    if (procesarBtn) procesarBtn.addEventListener('click', () => procesarDatos(false));
    if (limpiarBtn) limpiarBtn.addEventListener('click', limpiarDatos);
    if (excelBtn) excelBtn.addEventListener('click', exportarExcel);
    if (pdfBtn) pdfBtn.addEventListener('click', exportarPDF);
    if (modoNocheBtn) modoNocheBtn.addEventListener('click', toggleModoNoche);
    if (demoBtn) demoBtn.addEventListener('click', generarDatosDemo);

    // Drag & Drop
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('archivoInput');

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                procesarArchivo(e.target.files[0]);
                e.target.value = '';
            }
        });

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                procesarArchivo(files[0]);
            }
        });
    }

    // Atajo de teclado: Ctrl+Enter para analizar
    const datosInput = document.getElementById('datosInput');
    if (datosInput) {
        datosInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                procesarDatos(false);
            }
        });
    }
});
