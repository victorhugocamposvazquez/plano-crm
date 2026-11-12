/**
 * Planta de ejemplo para «Plano en 3D»: nave frigorífica con cámaras de congelado, pasillos refrigerados y muelles.
 * Sale de un plano real de instalación frigorífica (planta baja, una central de CO2), sin nombres de cliente ni el PDF.
 * Qué es dato del plano y qué no:
 * - Nombre, superficie, altura y temperatura de cada recinto: rótulos del plano.
 * - Contornos, posición de equipos y trazado de tuberías: trazos del PDF, en puntos del PDF (origen arriba a la izquierda).
 * - Escala: 0,1495 m por punto, de las superficies rotuladas de las cuatro cámaras (coinciden con error menor del 0,1 %).
 * - Diámetros: rótulos del plano leídos por una persona. Donde el rótulo falta o se contradice, el tramo lleva `duda`.
 * Los recintos y equipos están transcritos a mano: Plano todavía no lee rótulos de un PDF.
 */
import type { Planta } from "./planta3d";

const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const bt = [{ c: "aspiracion-bt", d: "1 3/8" }, { c: "liquido", d: "3/4" }, { c: "gas-caliente", d: "1 1/8", n: 2 }] as const;
const mt = [{ c: "aspiracion-mt", d: "3/4" }, { c: "liquido", d: "5/8" }] as const;

export const plantaEjemplo: Planta = {
  id: "nave-frigorifica",
  nombre: "Nave frigorífica · planta baja",
  origen: "Plano de instalación frigorífica, planta baja. Una única central de CO2.",
  escala: 0.1495,
  recintos: [
    { id: "camara-01", nombre: "Cámara 01", contorno: rect(52.1, 352.3, 173.9, 478), superficie: 341.98, alto: 9.65, temp: [-25, -25], uso: "congelado" },
    { id: "camara-02", nombre: "Cámara 02", contorno: rect(52.1, 220.1, 173.9, 345.2), superficie: 340.71, alto: 9.65, temp: [-25, -25], uso: "congelado" },
    { id: "camara-03", nombre: "Cámara 03", contorno: rect(215.4, 220.1, 304.6, 345.2), superficie: 249.59, alto: 9.65, temp: [-25, -25], uso: "congelado" },
    { id: "camara-04", nombre: "Cámara 04", contorno: rect(215.4, 352.3, 304.6, 478), superficie: 250.53, alto: 9.65, temp: [-25, -25], uso: "congelado" },
    { id: "pasillo-1", nombre: "Pasillo cámaras 1", contorno: rect(175.2, 352.3, 214, 449.8), superficie: 84.55, alto: 4.4, temp: [5, 8], uso: "refrigerado" },
    { id: "pasillo-2", nombre: "Pasillo cámaras 2", contorno: rect(175.2, 214.7, 214, 349.9), superficie: 114.98, alto: 4.4, temp: [5, 8], uso: "refrigerado" },
    { id: "sas", nombre: "SAS", contorno: rect(175.2, 452, 214, 478.6), superficie: 22.33, alto: 4.4, uso: "servicio" },
    { id: "muelles-baja", nombre: "Muelles zona baja", contorno: [[93.2, 480.4], [310.3, 480.4], [310.3, 548.6], [227.4, 548.6], [227.4, 574], [46.7, 574], [46.7, 508.1], [93.2, 508.1]], superficie: 464.94, alto: 3.6, temp: [12, 15], uso: "atemperado" },
    { id: "muelles-alta", nombre: "Muelles zona alta", contorno: rect(311, 481, 439.6, 548.6), superficie: 190.16, alto: 9.65, temp: [18, 20], uso: "ambiente" },
    { id: "almacen-seco", nombre: "Almacén seco", contorno: [[307, 214.7], [391.6, 214.7], [391.6, 284], [439.6, 284], [439.6, 479.3], [307, 479.3]], superficie: 709.13, alto: 9.8, temp: [18, 20], uso: "ambiente" },
    { id: "carga-baterias", nombre: "Carga de baterías", contorno: rect(391.6, 214.7, 439.6, 284), superficie: 71.57, alto: 9.8, uso: "servicio" },
    { id: "antecamara", nombre: "Antecámara", contorno: rect(47.4, 574.7, 219.8, 602), superficie: 105.94, alto: 3.7, uso: "servicio" },
    { id: "aseos", nombre: "Aseos", contorno: rect(46.7, 480.4, 93.2, 508.1), superficie: 23.24, alto: 2.5, uso: "servicio" },
    { id: "escalera", nombre: "Escalera y ascensor", contorno: rect(228.7, 550, 257.5, 615.1), superficie: 33.12, alto: 2.44, uso: "servicio" },
    { id: "oficinas", nombre: "Oficina y comedor", contorno: rect(360.4, 550.7, 439.6, 616.4), superficie: 90.97, alto: 3.1, uso: "servicio" }
  ],
  equipos: [
    { id: "BT01", recinto: "camara-02", modelo: "TEWSSC80-2", clase: "cubico", caja: [72.6, 330.1, 93, 337.4] },
    { id: "BT02", recinto: "camara-02", modelo: "TEWSSC80-2", clase: "cubico", caja: [133.8, 329.9, 154.2, 337.2] },
    { id: "BT03", recinto: "camara-01", modelo: "TEWSSC80-1", clase: "cubico", caja: [72.6, 359, 93, 366.4] },
    { id: "BT04", recinto: "camara-01", modelo: "TEWSSC80-1", clase: "cubico", caja: [133.8, 359, 154.2, 366.4] },
    { id: "BT05", recinto: "camara-03", modelo: "TEWSSC75-3", clase: "cubico", caja: [220.1, 329.3, 240.5, 336.4] },
    { id: "BT06", recinto: "camara-03", modelo: "TEWSSC75-3", clase: "cubico", caja: [273.1, 329.4, 293.5, 336.6] },
    { id: "BT07", recinto: "camara-04", modelo: "TEWSSC80-4", clase: "cubico", caja: [220.1, 360.5, 240.5, 367.8] },
    { id: "BT08", recinto: "camara-04", modelo: "TEWSSC80-4", clase: "cubico", caja: [273.1, 360.7, 293.5, 368] },
    { id: "MT01", recinto: "pasillo-2", modelo: "TEWSDC50", clase: "plafon", caja: [186.1, 284.3, 205.2, 293.6] },
    { id: "MT02", recinto: "pasillo-1", modelo: "TEWSDC50", clase: "plafon", caja: [187.4, 393.2, 206.4, 402.6] },
    { id: "MT03", recinto: "muelles-baja", modelo: "TEWSDC45", clase: "muelle", caja: [75.4, 518.6, 85.6, 532.4] },
    { id: "MT04", recinto: "muelles-baja", modelo: "TEWSDC45", clase: "muelle", caja: [141.4, 518.6, 151.6, 532.4] },
    { id: "MT05", recinto: "muelles-baja", modelo: "TEWSDC45", clase: "muelle", caja: [207.4, 518.6, 217.6, 532.4] },
    { id: "MT06", recinto: "muelles-baja", modelo: "TEWSDC45", clase: "muelle", caja: [273.4, 505.8, 283.6, 519.6] }
  ],
  tramos: [
    { id: "montante", nombre: "Montante por el pasillo de cámaras 1", puntos: [[184, 481], [184, 354]], lineas: [{ c: "aspiracion-bt", d: "3 1/8" }, { c: "liquido", d: "2 1/8" }, { c: "aspiracion-mt", d: "1 5/8" }, { c: "gas-caliente", d: "1 3/8", n: 2 }] },
    { id: "tronco-oeste-a", nombre: "Tronco entre cámaras 01 y 02, junto al pasillo", puntos: [[184, 354], [136, 354]], lineas: [{ c: "aspiracion-bt", d: "2 1/8" }, { c: "liquido", d: "1 3/8" }, { c: "gas-caliente", d: "1 1/8", n: 2 }] },
    { id: "tronco-oeste-b", nombre: "Tronco entre cámaras 01 y 02, centro", puntos: [[136, 354], [90, 354]], lineas: [{ c: "aspiracion-bt", d: "1 5/8" }, { c: "liquido", d: "1 3/8" }, { c: "gas-caliente", d: "1 1/8", n: 2 }] },
    { id: "tronco-oeste-c", nombre: "Tronco entre cámaras 01 y 02, extremo", puntos: [[90, 354], [76, 354]], lineas: [...bt] },
    { id: "tronco-este-a", nombre: "Tronco entre cámaras 03 y 04, junto al pasillo", puntos: [[184, 354], [238.7, 354]], lineas: [{ c: "aspiracion-bt", d: "2 1/8" }, { c: "liquido", d: "1 3/8" }, { c: "aspiracion-mt", d: "1 3/8" }, { c: "gas-caliente", d: "1 1/8", n: 2 }] },
    { id: "tronco-este-b", nombre: "Tronco entre cámaras 03 y 04, extremo", puntos: [[238.7, 354], [277.6, 354]], lineas: [{ c: "aspiracion-bt", d: "1 5/8" }, { c: "liquido", d: "1 3/8" }, { c: "aspiracion-mt", d: "1 1/8" }, { c: "gas-caliente", d: "1 1/8", n: 2 }] },
    { id: "ramal-BT01", nombre: "Ramal a BT01", equipo: "BT01", puntos: [[90, 354], [90, 337.5]], lineas: [...bt] },
    { id: "ramal-BT02", nombre: "Ramal a BT02", equipo: "BT02", puntos: [[152, 354], [152, 337.2]], lineas: [...bt] },
    { id: "ramal-BT03", nombre: "Ramal a BT03", equipo: "BT03", puntos: [[76, 354], [76, 359]], lineas: [...bt] },
    { id: "ramal-BT04", nombre: "Ramal a BT04", equipo: "BT04", puntos: [[136, 354], [136, 359]], lineas: [...bt] },
    { id: "ramal-BT05", nombre: "Ramal a BT05", equipo: "BT05", puntos: [[238.7, 354], [238.7, 336.4]], lineas: [{ c: "aspiracion-bt", d: "1 5/8" }, { c: "liquido", d: "1 1/8" }, { c: "gas-caliente", d: "1 1/8", n: 2 }], duda: "El rótulo de BT05 da diámetros mayores que los de BT06, que es el mismo modelo." },
    { id: "ramal-BT06", nombre: "Ramal a BT06", equipo: "BT06", puntos: [[277.6, 354], [277.6, 336.6]], lineas: [...bt] },
    { id: "ramal-BT07", nombre: "Ramal a BT07", equipo: "BT07", puntos: [[224, 354], [224, 360.5]], lineas: [...bt, { c: "aspiracion-mt", d: "1 1/8" }], duda: "BT07 lleva además una aspiración de media rotulada en el plano." },
    { id: "ramal-BT08", nombre: "Ramal a BT08", equipo: "BT08", puntos: [[276, 354], [276, 360.7]], lineas: [...bt] },
    { id: "ramal-MT01", nombre: "Ramal a MT01", equipo: "MT01", puntos: [[182.2, 354], [182.2, 293], [175.7, 293], [175.7, 291.3], [186.1, 291.3]], lineas: [...mt] },
    { id: "ramal-MT02", nombre: "Ramal a MT02", equipo: "MT02", puntos: [[184, 392.6], [211.9, 392.6]], lineas: [...mt] },
    { id: "colector-este-a", nombre: "Colector de muelles, tramo este junto al montante", puntos: [[184, 481.8], [213.7, 481.8]], lineas: [{ c: "aspiracion-mt", d: "1 1/8" }, { c: "liquido", d: "1 1/8" }] },
    { id: "colector-este-b", nombre: "Colector de muelles, tramo este final", puntos: [[213.7, 481.8], [240.3, 481.8], [240.3, 487.7], [246, 487.7], [246, 481.8], [273.6, 481.8]], lineas: [...mt], duda: "El rótulo de este tramo repite «A MT Ø5/8» dos veces; se toma como los demás ramales de media." },
    { id: "colector-oeste-a", nombre: "Colector de muelles, tramo oeste junto al montante", puntos: [[184, 481.8], [180.1, 481.8], [180.1, 487.7], [174.4, 487.7], [174.4, 481.8], [148.6, 481.8]], lineas: [{ c: "aspiracion-mt", d: "1 1/8" }, { c: "liquido", d: "1 1/8" }] },
    { id: "colector-oeste-b", nombre: "Colector de muelles, tramo oeste final", puntos: [[148.6, 481.8], [137.3, 481.8], [137.3, 487.7], [131, 487.7], [131, 481.8], [95.2, 481.8]], lineas: [...mt], duda: "Tramo sin rótulo de diámetro; se toma el del ramal que alimenta." },
    { id: "ramal-MT03", nombre: "Ramal a MT03", equipo: "MT03", puntos: [[95.2, 481.8], [95.2, 510], [80.8, 510], [80.8, 518.6]], lineas: [...mt] },
    { id: "ramal-MT04", nombre: "Ramal a MT04", equipo: "MT04", puntos: [[148.6, 481.8], [148.6, 518.6]], lineas: [...mt] },
    { id: "ramal-MT05", nombre: "Ramal a MT05", equipo: "MT05", puntos: [[213.7, 481.8], [213.7, 518.6]], lineas: [...mt], duda: "El rótulo de MT05 trae aspiración y líquido cambiados respecto a MT03 y MT04." },
    { id: "ramal-MT06", nombre: "Ramal a MT06", equipo: "MT06", puntos: [[273.6, 481.8], [273.6, 505.8]], lineas: [...mt] }
  ]
};
