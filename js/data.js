/* ============================================================
   CÓRDOVA RESTAURANTE — Datos de estaciones, checklists y horarios
   Edita este archivo para agregar/quitar preguntas o estaciones.
   ============================================================ */

// Horarios de alarmas (formato 24h "HH:MM"). Todos los PC de cada
// estación deben tener esta misma app abierta para que suenen.
const SCHEDULE = {
  // Checklist completo de mise en place (todas las estaciones)
  checklistTimes: ["11:30", "18:30"],
  // Minutos de gracia antes de marcar un checklist como "atrasado"
  graceMinutes: 15,

  // Limpieza general del área (todas las estaciones)
  areaCleanTimes: ["11:00", "17:00"],

  // Recordatorio de servir la comida del personal (todas las estaciones)
  staffMealTimes: ["11:00", "17:00"],

  // Lavado de trapos de cocina — SOLO estación Parrilla
  towelWashTime: "15:00",

  // Limpieza del burlete del Rational — TODAS las estaciones
  burleteTime: "15:00",
};

// Nombres del personal disponible para elegir como "Responsable de la
// estación" en el checklist. Edita esta lista cuando cambie el equipo.
const STAFF_NAMES = ["ISIDORO", "MIGUEL", "HERNANDO", "IVAN", "ADRIAN", "DAVID", "JUAN", "MAICOL", "MAIRA"];

// Clave simple para entrar al dashboard gerencial (sin cuentas de Firebase).
// CÁMBIALA por la que quieras usar en el restaurante — es lo único que
// protege el panel, así que evita dejar la que viene por defecto.
const ADMIN_PASSCODE = "cordova2026";

// Utilidad para marcar preguntas "críticas": si la respuesta es "No",
// se considera un incumplimiento crítico (bloquea operación) y se
// resalta en rojo fuerte en el dashboard, no solo como advertencia.
function item(id, label, critical = false) {
  return { id, label, critical };
}

const STATIONS = [
  {
    id: "parrilla",
    name: "Parrilla",
    icon: "🔥",
    items: [
      item("internet", "Conexión a internet estable y funcional en pantalla", true),
      item("base_chef", "Disponibilidad de base del chef"),
      item("salsa_carne", "Disponibilidad de salsa de carne"),
      item("salsa_bbq", "Disponibilidad de salsa BBQ"),
      item("sal", "Disponibilidad de sal"),
      item("sal_gruesa", "Disponibilidad de sal gruesa"),
      item("pimienta", "Disponibilidad de pimienta"),
      item("tomillo", "Disponibilidad de tomillo"),
      item("bandejas_apoyo", "Disponibilidad de bandejas de apoyo"),
      item("brocha", "Disponibilidad de brocha"),
      item("tablas", "Disponibilidad de las 2 tablas requeridas"),
      item("cuchillo", "Disponibilidad de cuchillo"),
      item("pinza_apoyo", "Disponibilidad de pinza de apoyo"),
      item("estacion_limpia", "Estación limpia al iniciar", true),
      item("parrilla_lista", "Parrilla limpia y lista para operar", true),
    ],
  },
  {
    id: "fritos",
    name: "Fritos",
    icon: "🍟",
    items: [
      item("platano_pelado", "¿Hay plátanos pelados disponibles?"),
      item("papas", "¿Hay papas disponibles?"),
      item("plato_chicharron", "¿Está disponible el plato de entrada para chicharrón?"),
      item("tajadas_entrada", "¿Hay tajadas para entrada disponibles?"),
      item("aguacate", "¿Hay aguacate disponible?"),
      item("gastric", "¿Hay gastric disponible?"),
      item("tajadas_yuca", "¿Hay tajadas de yuca disponibles?"),
      item("guacamole", "¿Hay guacamole disponible?"),
      item("ajo_amarillo", "¿Hay ajo amarillo disponible?"),
      item("galleta_parmesano", "¿Hay galleta de parmesano disponible?"),
      item("paprika", "¿Hay páprika disponible?"),
      item("ajo", "¿Hay ajo disponible?"),
      item("plato_chorizo", "¿Está disponible el plato de entrada para chorizo?"),
      item("escurridores", "¿Están disponibles los escurridores?"),
      item("plato_porciones", "¿Está disponible el plato para porciones?"),
      item("cuchillo", "¿Está disponible el cuchillo?"),
      item("utensilios_fritura", "¿Están disponibles los utensilios de fritura?"),
      item("chicharron", "¿Hay chicharrón disponible?"),
      item("freidora_lista", "¿La freidora está limpia y lista para operar?", true),
      item("superficies_limpias", "¿Las superficies de trabajo están limpias y desinfectadas?", true),
    ],
  },
  {
    id: "armado",
    name: "Armado / Cantador",
    icon: "🍽️",
    items: [
      item("pantalla_config", "🖥️ ¿Tiene configurados en su pantalla los productos correspondientes a su estación?", true),
      item("pechuga_filete", "¿Hay pechuga filete disponible?"),
      item("medallon_cerdo", "¿Hay medallón de cerdo disponible?"),
      item("salsa_champinones", "¿Hay salsa de champiñones disponible?"),
      item("salsa_maracuya", "¿Hay salsa de maracuyá disponible?"),
      item("salsa_tocineta", "¿Hay salsa de tocineta disponible?"),
      item("pure_papa", "¿Hay puré de papa disponible?"),
      item("queso_parmesano", "¿Hay queso parmesano disponible?"),
      item("decor_tocineta", "¿Hay decoración de tocineta disponible?"),
      item("decor_champinones", "¿Hay decoración de champiñones disponible?"),
      item("decor_maracuya", "¿Hay decoración de maracuyá disponible?"),
      item("romero", "¿Hay romero disponible?"),
      item("ajo_patacones", "¿Hay ajo para patacones disponible?"),
      item("servilletas", "¿Hay servilletas disponibles?"),
      item("tablas", "¿Están disponibles las tablas?"),
      item("plato_porciones", "¿Está disponible el plato para porciones?"),
      item("cuchillo", "¿Está disponible el cuchillo?"),
      item("samovares", "¿Los samovares calientes están listos para operar?", true),
      item("recipientes_pure", "¿Están disponibles los recipientes para puré?"),
    ],
  },
  {
    id: "corrientes",
    name: "Corrientes / Sopas / Mote",
    icon: "🍲",
    items: [
      item("pantalla_config", "🖥️ ¿Tiene configurados en su pantalla los productos correspondientes a su estación?", true),
      item("tajadas_corriente", "¿Hay tajadas para corriente y mote disponibles?"),
      item("sopas_dia", "¿Hay sopas del día disponibles en samovar?"),
      item("arroz_dia", "¿Hay arroz del día disponible en samovar?"),
      item("mote_queso", "¿Hay mote de queso disponible en samovar?"),
      item("yuca_samovar", "¿Hay yuca disponible en samovar?"),
      item("queso_frito", "¿Hay queso frito disponible?"),
      item("queso_sin_freir", "¿Hay queso sin freír disponible?"),
      item("berenjena_frita", "¿Hay berenjena frita disponible?"),
      item("aguacate", "¿Hay aguacate disponible?"),
      item("cebolla_encurtida", "¿Hay cebolla encurtida disponible?"),
      item("pina", "¿Hay piña disponible?"),
      item("pepino_encurtido", "¿Hay pepino encurtido disponible?"),
      item("cebolla", "¿Hay cebolla disponible?"),
      item("uvas_pasas", "¿Hay uvas pasas disponibles?"),
      item("lechuga", "¿Hay lechuga disponible?"),
      item("tocineta", "¿Hay tocineta disponible?"),
      item("limon", "¿Hay limón disponible?"),
      item("platos_mote", "¿Están disponibles los platos de mote?"),
      item("plato_entrada_mote", "¿Está disponible el plato de entrada para mote?"),
      item("recipientes_adicionales", "¿Están disponibles los recipientes para adicionales?"),
      item("cucharones", "¿Están disponibles los cucharones?"),
      item("bandeja_gratinada", "¿Está disponible la bandeja de gratinada?"),
      item("espatulas", "¿Están disponibles las espátulas?"),
      item("cuchillo", "¿Está disponible el cuchillo?"),
      item("mesa_despejada", "¿La mesa de trabajo está despejada?", true),
      item("samovar_caliente", "¿El samovar está caliente y listo para operar?", true),
      item("tabla_picar", "¿Está disponible tabla para picar?"),
    ],
  },
  {
    id: "pastas",
    name: "Pastas y Mariscos",
    icon: "🍝",
    items: [
      item("internet", "📡 ¿Cuenta con conexión a internet estable y funcional en su pantalla?", true),
      item("aguacate", "¿Hay aguacate disponible?"),
      item("pan", "¿Hay pan disponible?"),
      item("parmesano", "¿Hay parmesano disponible?"),
      item("cebolla_brunoise", "¿Hay cebolla en brunoise disponible?"),
      item("ajo", "¿Hay ajo disponible?"),
      item("bechamel_coco", "¿Hay bechamel de coco disponible?"),
      item("pastas", "¿Hay pastas disponibles?"),
      item("leche", "¿Hay leche disponible?"),
      item("crema_leche", "¿Hay crema de leche disponible?"),
      item("mozzarella", "¿Hay queso mozzarella disponible?"),
      item("vegetales_arroz_camaron", "¿Hay vegetales para arroz de camarón disponibles?"),
      item("pimenton", "¿Hay pimentón disponible?"),
      item("cebolla", "¿Hay cebolla disponible?"),
      item("guiso_cazuela", "¿Hay guiso de la cazuela disponible?"),
      item("arroz_blanco", "¿Hay arroz blanco disponible?"),
      item("coco_frito", "¿Hay coco frito disponible?"),
      item("bisque", "¿Hay bisque disponible?"),
      item("huevos", "¿Hay huevos disponibles?"),
      item("sal", "¿Hay sal disponible?"),
      item("pimienta", "¿Hay pimienta disponible?"),
      item("guiso_lengua", "¿Hay guiso de lengua disponible?"),
      item("bandeja_filete", "¿Está disponible la bandeja de filete?"),
      item("plato_cazuela", "¿Está disponible el plato de cazuela?"),
      item("plato_arroz", "¿Está disponible el plato de arroz?"),
      item("plato_pasta", "¿Está disponible el plato de pasta?"),
      item("bandeja_lengua", "¿Está disponible la bandeja de lengua?"),
      item("cuchillo", "¿Está disponible el cuchillo?"),
      item("tabla", "¿Está disponible la tabla?"),
      item("bowl", "¿Está disponible el bowl?"),
      item("batidor_globo", "¿Está disponible el batidor globo?"),
      item("espatulas", "¿Están disponibles las espátulas?"),
      item("sartenes", "¿Están disponibles los sartenes?"),
      item("cucharon_pastas", "¿Está disponible el cucharón para pastas?"),
    ],
  },
];
