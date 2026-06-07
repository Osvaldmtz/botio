export type CityTimezoneEntry = {
  aliases: string[];
  timezone: string;
  country: string;
  label: string;
  city: string;
};

export const CITY_TIMEZONE_ENTRIES: CityTimezoneEntry[] = [
  {
    "aliases": [
      "cdmx",
      "ciudad de mexico",
      "mexico df",
      "mexico city",
      "df",
      "distrito federal"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "CDMX"
  },
  {
    "aliases": [
      "mexicali",
      "tijuana",
      "ensenada",
      "rosarito",
      "tecate"
    ],
    "timezone": "America/Tijuana",
    "country": "México",
    "label": "hora Pacífico",
    "city": "Mexicali"
  },
  {
    "aliases": [
      "cancun",
      "playa del carmen",
      "tulum",
      "cozumel",
      "isla mujeres"
    ],
    "timezone": "America/Cancun",
    "country": "México",
    "label": "hora Cancún",
    "city": "Cancún"
  },
  {
    "aliases": [
      "hermosillo",
      "sonora",
      "ciudad obregon",
      "guaymas",
      "navojoa"
    ],
    "timezone": "America/Hermosillo",
    "country": "México",
    "label": "hora Sonora",
    "city": "Hermosillo"
  },
  {
    "aliases": [
      "chihuahua",
      "juarez",
      "ciudad juarez",
      "delicias",
      "parral"
    ],
    "timezone": "America/Chihuahua",
    "country": "México",
    "label": "hora Chihuahua",
    "city": "Chihuahua"
  },
  {
    "aliases": [
      "monterrey",
      "saltillo",
      "torreon",
      "monclova",
      "piedras negras",
      "nuevo laredo",
      "reynosa",
      "matamoros"
    ],
    "timezone": "America/Monterrey",
    "country": "México",
    "label": "hora Monterrey",
    "city": "Monterrey"
  },
  {
    "aliases": [
      "guadalajara",
      "puerto vallarta",
      "leon",
      "queretaro",
      "puebla",
      "merida",
      "oaxaca",
      "veracruz",
      "acapulco",
      "mazatlan",
      "morelia",
      "aguascalientes",
      "san luis potosi",
      "pachuca",
      "toluca",
      "cuernavaca",
      "tlaxcala",
      "tepic",
      "colima",
      "villahermosa",
      "tuxtla gutierrez",
      "campeche",
      "chetumal",
      "chilpancingo",
      "durango",
      "zacatecas"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "Guadalajara"
  },
  {
    "aliases": [
      "bogota",
      "cali",
      "medellin",
      "barranquilla",
      "cartagena",
      "bucaramanga",
      "pereira",
      "manizales",
      "ibague",
      "cucuta",
      "santa marta",
      "pasto",
      "monteria",
      "armenia",
      "sincelejo",
      "popayan",
      "valledupar",
      "neiva",
      "florencia",
      "villavicencio",
      "tunja",
      "riohacha",
      "quibdo",
      "leticia",
      "mocoa",
      "yopal",
      "arauca",
      "mitu",
      "puerto carreno",
      "san andres",
      "inirida",
      "san jose del guaviare"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "Bogotá"
  },
  {
    "aliases": [
      "lima",
      "arequipa",
      "trujillo",
      "cusco",
      "chiclayo",
      "piura",
      "iquitos",
      "huancayo",
      "tacna",
      "ica",
      "puno",
      "chimbote",
      "ayacucho",
      "cajamarca",
      "pucallpa",
      "huaraz",
      "tumbes"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "Lima"
  },
  {
    "aliases": [
      "buenos aires",
      "caba",
      "cordoba",
      "rosario",
      "mendoza",
      "la plata",
      "mar del plata",
      "tucuman",
      "salta",
      "santa fe",
      "san juan",
      "resistencia",
      "corrientes",
      "posadas",
      "bahia blanca",
      "neuquen",
      "formosa",
      "la rioja",
      "comodoro rivadavia",
      "rio gallegos",
      "ushuaia",
      "jujuy"
    ],
    "timezone": "America/Argentina/Buenos_Aires",
    "country": "Argentina",
    "label": "hora Argentina",
    "city": "Buenos Aires"
  },
  {
    "aliases": [
      "santiago",
      "santiago de chile",
      "valparaiso",
      "concepcion",
      "la serena",
      "antofagasta",
      "temuco",
      "rancagua",
      "iquique",
      "arica",
      "puerto montt",
      "punta arenas",
      "chillan",
      "osorno",
      "valdivia",
      "calama",
      "copiapo"
    ],
    "timezone": "America/Santiago",
    "country": "Chile",
    "label": "hora Chile",
    "city": "Santiago"
  },
  {
    "aliases": [
      "montevideo",
      "punta del este",
      "salto",
      "paysandu",
      "maldonado",
      "colonia",
      "rivera",
      "tacuarembo"
    ],
    "timezone": "America/Montevideo",
    "country": "Uruguay",
    "label": "hora Uruguay",
    "city": "Montevideo"
  },
  {
    "aliases": [
      "caracas",
      "maracaibo",
      "valencia",
      "barquisimeto",
      "maracay",
      "ciudad guayana",
      "san cristobal",
      "maturin",
      "ciudad bolivar",
      "cumana",
      "merida venezuela",
      "barinas",
      "porlamar",
      "puerto la cruz"
    ],
    "timezone": "America/Caracas",
    "country": "Venezuela",
    "label": "hora Venezuela",
    "city": "Caracas"
  },
  {
    "aliases": [
      "quito",
      "guayaquil",
      "cuenca",
      "santo domingo de los tsachilas",
      "machala",
      "manta",
      "portoviejo",
      "ambato",
      "riobamba",
      "loja",
      "esmeraldas",
      "ibarra"
    ],
    "timezone": "America/Guayaquil",
    "country": "Ecuador",
    "label": "hora Ecuador",
    "city": "Quito"
  },
  {
    "aliases": [
      "la paz",
      "santa cruz",
      "cochabamba",
      "sucre",
      "oruro",
      "potosi",
      "tarija",
      "trinidad bolivia",
      "cobija",
      "el alto"
    ],
    "timezone": "America/La_Paz",
    "country": "Bolivia",
    "label": "hora Bolivia",
    "city": "La Paz"
  },
  {
    "aliases": [
      "asuncion",
      "ciudad del este",
      "encarnacion",
      "pedro juan caballero",
      "concepcion paraguay"
    ],
    "timezone": "America/Asuncion",
    "country": "Paraguay",
    "label": "hora Paraguay",
    "city": "Asunción"
  },
  {
    "aliases": [
      "guatemala",
      "ciudad de guatemala",
      "antigua guatemala",
      "quetzaltenango",
      "escuintla"
    ],
    "timezone": "America/Guatemala",
    "country": "Guatemala",
    "label": "hora Guatemala",
    "city": "Guatemala"
  },
  {
    "aliases": [
      "san salvador",
      "santa ana",
      "san miguel"
    ],
    "timezone": "America/El_Salvador",
    "country": "El Salvador",
    "label": "hora El Salvador",
    "city": "San Salvador"
  },
  {
    "aliases": [
      "tegucigalpa",
      "san pedro sula",
      "la ceiba",
      "choloma"
    ],
    "timezone": "America/Tegucigalpa",
    "country": "Honduras",
    "label": "hora Honduras",
    "city": "Tegucigalpa"
  },
  {
    "aliases": [
      "managua",
      "leon nicaragua",
      "masaya",
      "granada nicaragua",
      "chinandega",
      "matagalpa"
    ],
    "timezone": "America/Managua",
    "country": "Nicaragua",
    "label": "hora Nicaragua",
    "city": "Managua"
  },
  {
    "aliases": [
      "san jose costa rica",
      "alajuela",
      "cartago",
      "heredia",
      "puntarenas",
      "liberia costa rica"
    ],
    "timezone": "America/Costa_Rica",
    "country": "Costa Rica",
    "label": "hora Costa Rica",
    "city": "San José"
  },
  {
    "aliases": [
      "panama",
      "ciudad de panama",
      "colon panama",
      "david"
    ],
    "timezone": "America/Panama",
    "country": "Panamá",
    "label": "hora Panamá",
    "city": "Panamá"
  },
  {
    "aliases": [
      "santo domingo",
      "punta cana",
      "santiago de los caballeros",
      "san pedro de macoris",
      "la romana",
      "puerto plata"
    ],
    "timezone": "America/Santo_Domingo",
    "country": "República Dominicana",
    "label": "hora Dominicana",
    "city": "Santo Domingo"
  },
  {
    "aliases": [
      "la habana",
      "havana",
      "habana",
      "santiago de cuba",
      "camaguey",
      "holguin",
      "guantanamo",
      "matanzas",
      "varadero"
    ],
    "timezone": "America/Havana",
    "country": "Cuba",
    "label": "hora Cuba",
    "city": "La Habana"
  },
  {
    "aliases": [
      "san juan puerto rico",
      "puerto rico",
      "ponce",
      "bayamon",
      "caguas",
      "mayaguez"
    ],
    "timezone": "America/Puerto_Rico",
    "country": "Puerto Rico",
    "label": "hora Puerto Rico",
    "city": "San Juan"
  },
  {
    "aliases": [
      "new york",
      "nueva york",
      "nyc",
      "miami",
      "orlando",
      "tampa",
      "atlanta",
      "washington",
      "boston",
      "philadelphia",
      "pittsburgh",
      "detroit",
      "cleveland",
      "cincinnati",
      "jacksonville",
      "fort lauderdale",
      "raleigh",
      "charlotte",
      "baltimore",
      "richmond"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "New York"
  },
  {
    "aliases": [
      "chicago",
      "dallas",
      "houston",
      "san antonio",
      "austin",
      "nashville",
      "new orleans",
      "minneapolis",
      "memphis",
      "milwaukee",
      "st louis",
      "kansas city",
      "oklahoma city",
      "tulsa",
      "omaha"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "Chicago"
  },
  {
    "aliases": [
      "denver",
      "salt lake city",
      "phoenix",
      "albuquerque",
      "el paso",
      "tucson",
      "colorado springs",
      "boise"
    ],
    "timezone": "America/Denver",
    "country": "USA",
    "label": "hora Montaña (USA)",
    "city": "Denver"
  },
  {
    "aliases": [
      "los angeles",
      "la usa",
      "san francisco",
      "sf usa",
      "san diego",
      "sacramento",
      "seattle",
      "portland",
      "las vegas",
      "long beach",
      "oakland",
      "fresno",
      "san jose usa",
      "anaheim"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "Los Angeles"
  },
  {
    "aliases": [
      "toronto",
      "ottawa",
      "montreal",
      "quebec",
      "halifax canada"
    ],
    "timezone": "America/Toronto",
    "country": "Canadá",
    "label": "hora Toronto",
    "city": "Toronto"
  },
  {
    "aliases": [
      "vancouver",
      "victoria canada"
    ],
    "timezone": "America/Vancouver",
    "country": "Canadá",
    "label": "hora Vancouver",
    "city": "Vancouver"
  },
  {
    "aliases": [
      "calgary",
      "edmonton"
    ],
    "timezone": "America/Edmonton",
    "country": "Canadá",
    "label": "hora Calgary",
    "city": "Calgary"
  },
  {
    "aliases": [
      "winnipeg"
    ],
    "timezone": "America/Winnipeg",
    "country": "Canadá",
    "label": "hora Winnipeg",
    "city": "Winnipeg"
  },
  {
    "aliases": [
      "sao paulo",
      "rio de janeiro",
      "brasilia",
      "salvador brasil",
      "fortaleza",
      "belo horizonte",
      "curitiba",
      "recife",
      "porto alegre",
      "belem",
      "goiania",
      "natal",
      "florianopolis"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "São Paulo"
  },
  {
    "aliases": [
      "madrid",
      "barcelona",
      "sevilla",
      "valencia espana",
      "bilbao",
      "malaga",
      "zaragoza",
      "palma",
      "palma de mallorca",
      "las palmas",
      "murcia",
      "granada espana",
      "cordoba espana",
      "valladolid",
      "vigo",
      "gijon",
      "a coruña",
      "oviedo",
      "pamplona",
      "salamanca"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "Madrid"
  },
  {
    "aliases": [
      "londres",
      "london",
      "manchester",
      "liverpool",
      "birmingham",
      "edinburgh",
      "edimburgo",
      "dublin"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "Londres"
  },
  {
    "aliases": [
      "paris",
      "lyon",
      "marseille",
      "marsella",
      "toulouse",
      "nice",
      "niza",
      "bordeaux"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "París"
  },
  {
    "aliases": [
      "berlin",
      "munich",
      "hamburg",
      "hamburgo",
      "frankfurt",
      "cologne",
      "colonia",
      "stuttgart"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "Berlín"
  },
  {
    "aliases": [
      "roma",
      "rome",
      "milan",
      "napoles",
      "napoli",
      "turin",
      "palermo",
      "florencia",
      "florence",
      "bologna",
      "bolonia",
      "venecia",
      "venice"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "Roma"
  },
  {
    "aliases": [
      "amsterdam",
      "rotterdam",
      "la haya",
      "utrecht"
    ],
    "timezone": "Europe/Amsterdam",
    "country": "Países Bajos",
    "label": "hora Amsterdam",
    "city": "Amsterdam"
  },
  {
    "aliases": [
      "lisboa",
      "lisbon",
      "porto",
      "oporto",
      "coimbra",
      "braga",
      "faro"
    ],
    "timezone": "Europe/Lisbon",
    "country": "Portugal",
    "label": "hora Lisboa",
    "city": "Lisboa"
  },
  {
    "aliases": [
      "bruselas",
      "brussels",
      "brujas",
      "antwerp",
      "amberes"
    ],
    "timezone": "Europe/Brussels",
    "country": "Bélgica",
    "label": "hora Bruselas",
    "city": "Bruselas"
  },
  {
    "aliases": [
      "zurich",
      "ginebra",
      "basel",
      "basilea",
      "berna"
    ],
    "timezone": "Europe/Zurich",
    "country": "Suiza",
    "label": "hora Suiza",
    "city": "Zúrich"
  },
  {
    "aliases": [
      "viena",
      "vienna",
      "salzburgo",
      "graz"
    ],
    "timezone": "Europe/Vienna",
    "country": "Austria",
    "label": "hora Viena",
    "city": "Viena"
  },
  {
    "aliases": [
      "estocolmo",
      "stockholm",
      "goteborg"
    ],
    "timezone": "Europe/Stockholm",
    "country": "Suecia",
    "label": "hora Estocolmo",
    "city": "Estocolmo"
  },
  {
    "aliases": [
      "oslo",
      "bergen"
    ],
    "timezone": "Europe/Oslo",
    "country": "Noruega",
    "label": "hora Oslo",
    "city": "Oslo"
  },
  {
    "aliases": [
      "copenhague",
      "copenhagen",
      "aarhus"
    ],
    "timezone": "Europe/Copenhagen",
    "country": "Dinamarca",
    "label": "hora Copenhague",
    "city": "Copenhague"
  },
  {
    "aliases": [
      "helsinki",
      "turku"
    ],
    "timezone": "Europe/Helsinki",
    "country": "Finlandia",
    "label": "hora Helsinki",
    "city": "Helsinki"
  },
  {
    "aliases": [
      "varsovia",
      "warsaw",
      "krakow",
      "cracovia"
    ],
    "timezone": "Europe/Warsaw",
    "country": "Polonia",
    "label": "hora Varsovia",
    "city": "Varsovia"
  },
  {
    "aliases": [
      "atenas",
      "athens",
      "thessaloniki",
      "salonica"
    ],
    "timezone": "Europe/Athens",
    "country": "Grecia",
    "label": "hora Atenas",
    "city": "Atenas"
  },
  {
    "aliases": [
      "moscu",
      "moscow",
      "san petersburgo"
    ],
    "timezone": "Europe/Moscow",
    "country": "Rusia",
    "label": "hora Moscú",
    "city": "Moscú"
  },
  {
    "aliases": [
      "estambul",
      "istanbul",
      "ankara"
    ],
    "timezone": "Europe/Istanbul",
    "country": "Turquía",
    "label": "hora Estambul",
    "city": "Estambul"
  },
  {
    "aliases": [
      "tokyo",
      "tokio",
      "osaka",
      "kyoto",
      "kioto",
      "yokohama"
    ],
    "timezone": "Asia/Tokyo",
    "country": "Japón",
    "label": "hora Tokio",
    "city": "Tokio"
  },
  {
    "aliases": [
      "hong kong"
    ],
    "timezone": "Asia/Hong_Kong",
    "country": "Hong Kong",
    "label": "hora Hong Kong",
    "city": "Hong Kong"
  },
  {
    "aliases": [
      "singapur",
      "singapore"
    ],
    "timezone": "Asia/Singapore",
    "country": "Singapur",
    "label": "hora Singapur",
    "city": "Singapur"
  },
  {
    "aliases": [
      "shanghai",
      "beijing",
      "pekin"
    ],
    "timezone": "Asia/Shanghai",
    "country": "China",
    "label": "hora China",
    "city": "Shanghái"
  },
  {
    "aliases": [
      "seul",
      "seoul",
      "busan"
    ],
    "timezone": "Asia/Seoul",
    "country": "Corea del Sur",
    "label": "hora Seúl",
    "city": "Seúl"
  },
  {
    "aliases": [
      "mumbai",
      "bombay",
      "delhi",
      "nueva delhi",
      "bangalore",
      "chennai",
      "kolkata"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "Mumbai"
  },
  {
    "aliases": [
      "bangkok"
    ],
    "timezone": "Asia/Bangkok",
    "country": "Tailandia",
    "label": "hora Bangkok",
    "city": "Bangkok"
  },
  {
    "aliases": [
      "dubai",
      "abu dhabi"
    ],
    "timezone": "Asia/Dubai",
    "country": "EAU",
    "label": "hora Dubai",
    "city": "Dubai"
  },
  {
    "aliases": [
      "sydney",
      "melbourne",
      "brisbane",
      "perth australia"
    ],
    "timezone": "Australia/Sydney",
    "country": "Australia",
    "label": "hora Sydney",
    "city": "Sydney"
  },
  {
    "aliases": [
      "apizaco"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "apizaco"
  },
  {
    "aliases": [
      "atlixco"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "atlixco"
  },
  {
    "aliases": [
      "campeche city"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "campeche city"
  },
  {
    "aliases": [
      "celaya"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "celaya"
  },
  {
    "aliases": [
      "cholula"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "cholula"
  },
  {
    "aliases": [
      "ciudad valles"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "ciudad valles"
  },
  {
    "aliases": [
      "coatzacoalcos"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "coatzacoalcos"
  },
  {
    "aliases": [
      "comitan"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "comitan"
  },
  {
    "aliases": [
      "cordoba mexico"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "cordoba mexico"
  },
  {
    "aliases": [
      "cosamaloapan"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "cosamaloapan"
  },
  {
    "aliases": [
      "cuautla"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "cuautla"
  },
  {
    "aliases": [
      "cuautitlan"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "cuautitlan"
  },
  {
    "aliases": [
      "ecatepec"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "ecatepec"
  },
  {
    "aliases": [
      "fresnillo"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "fresnillo"
  },
  {
    "aliases": [
      "guanajuato"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "guanajuato"
  },
  {
    "aliases": [
      "huajuapan"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "huajuapan"
  },
  {
    "aliases": [
      "huatulco"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "huatulco"
  },
  {
    "aliases": [
      "irapuato"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "irapuato"
  },
  {
    "aliases": [
      "ixtapa"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "ixtapa"
  },
  {
    "aliases": [
      "ixtlahuaca"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "ixtlahuaca"
  },
  {
    "aliases": [
      "jilotepec"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "jilotepec"
  },
  {
    "aliases": [
      "jiutepec"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "jiutepec"
  },
  {
    "aliases": [
      "jojutla"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "jojutla"
  },
  {
    "aliases": [
      "la piedad"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "la piedad"
  },
  {
    "aliases": [
      "lazaro cardenas"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "lazaro cardenas"
  },
  {
    "aliases": [
      "linares"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "linares"
  },
  {
    "aliases": [
      "los mochis"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "los mochis"
  },
  {
    "aliases": [
      "manzanillo"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "manzanillo"
  },
  {
    "aliases": [
      "matamoros tamaulipas"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "matamoros tamaulipas"
  },
  {
    "aliases": [
      "minatitlan"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "minatitlan"
  },
  {
    "aliases": [
      "miramar"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "miramar"
  },
  {
    "aliases": [
      "moroleon"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "moroleon"
  },
  {
    "aliases": [
      "naucalpan"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "naucalpan"
  },
  {
    "aliases": [
      "nogales sonora"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "nogales sonora"
  },
  {
    "aliases": [
      "ocotlan"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "ocotlan"
  },
  {
    "aliases": [
      "ocoyoacac"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "ocoyoacac"
  },
  {
    "aliases": [
      "ometepec"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "ometepec"
  },
  {
    "aliases": [
      "orizaba"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "orizaba"
  },
  {
    "aliases": [
      "poza rica"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "poza rica"
  },
  {
    "aliases": [
      "progreso"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "progreso"
  },
  {
    "aliases": [
      "puerto escondido"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "puerto escondido"
  },
  {
    "aliases": [
      "puerto penasco"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "puerto penasco"
  },
  {
    "aliases": [
      "salamanca mexico"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "salamanca mexico"
  },
  {
    "aliases": [
      "san cristobal de las casas"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "san cristobal de las casas"
  },
  {
    "aliases": [
      "san juan del rio"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "san juan del rio"
  },
  {
    "aliases": [
      "san luis rio colorado"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "san luis rio colorado"
  },
  {
    "aliases": [
      "san martin texmelucan"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "san martin texmelucan"
  },
  {
    "aliases": [
      "santa catarina"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "santa catarina"
  },
  {
    "aliases": [
      "santa rosa jauregui"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "santa rosa jauregui"
  },
  {
    "aliases": [
      "silao"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "silao"
  },
  {
    "aliases": [
      "tapachula"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "tapachula"
  },
  {
    "aliases": [
      "tehuacan"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "tehuacan"
  },
  {
    "aliases": [
      "tehuantepec"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "tehuantepec"
  },
  {
    "aliases": [
      "temixco"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "temixco"
  },
  {
    "aliases": [
      "tenancingo"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "tenancingo"
  },
  {
    "aliases": [
      "texcoco"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "texcoco"
  },
  {
    "aliases": [
      "tlalnepantla"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "tlalnepantla"
  },
  {
    "aliases": [
      "tlaxcoapan"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "tlaxcoapan"
  },
  {
    "aliases": [
      "tula de allende"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "tula de allende"
  },
  {
    "aliases": [
      "uruapan"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "uruapan"
  },
  {
    "aliases": [
      "xalapa"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "xalapa"
  },
  {
    "aliases": [
      "zacapoaxtla"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "zacapoaxtla"
  },
  {
    "aliases": [
      "zacatepec"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "zacatepec"
  },
  {
    "aliases": [
      "zamora mexico"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "zamora mexico"
  },
  {
    "aliases": [
      "zihuatanejo"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "zihuatanejo"
  },
  {
    "aliases": [
      "zinacantepec"
    ],
    "timezone": "America/Mexico_City",
    "country": "México",
    "label": "hora CDMX",
    "city": "zinacantepec"
  },
  {
    "aliases": [
      "la paz baja california"
    ],
    "timezone": "America/Tijuana",
    "country": "México",
    "label": "hora Pacífico",
    "city": "la paz baja california"
  },
  {
    "aliases": [
      "loreto"
    ],
    "timezone": "America/Tijuana",
    "country": "México",
    "label": "hora Pacífico",
    "city": "loreto"
  },
  {
    "aliases": [
      "los cabos"
    ],
    "timezone": "America/Tijuana",
    "country": "México",
    "label": "hora Pacífico",
    "city": "los cabos"
  },
  {
    "aliases": [
      "san felipe"
    ],
    "timezone": "America/Tijuana",
    "country": "México",
    "label": "hora Pacífico",
    "city": "san felipe"
  },
  {
    "aliases": [
      "san quintin"
    ],
    "timezone": "America/Tijuana",
    "country": "México",
    "label": "hora Pacífico",
    "city": "san quintin"
  },
  {
    "aliases": [
      "san ysidro"
    ],
    "timezone": "America/Tijuana",
    "country": "México",
    "label": "hora Pacífico",
    "city": "san ysidro"
  },
  {
    "aliases": [
      "valle de guadalupe"
    ],
    "timezone": "America/Tijuana",
    "country": "México",
    "label": "hora Pacífico",
    "city": "valle de guadalupe"
  },
  {
    "aliases": [
      "albany"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "albany"
  },
  {
    "aliases": [
      "allentown"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "allentown"
  },
  {
    "aliases": [
      "ann arbor"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "ann arbor"
  },
  {
    "aliases": [
      "annapolis"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "annapolis"
  },
  {
    "aliases": [
      "asheville"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "asheville"
  },
  {
    "aliases": [
      "augusta"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "augusta"
  },
  {
    "aliases": [
      "burlington"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "burlington"
  },
  {
    "aliases": [
      "cambridge usa"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "cambridge usa"
  },
  {
    "aliases": [
      "canton"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "canton"
  },
  {
    "aliases": [
      "charleston"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "charleston"
  },
  {
    "aliases": [
      "columbia sc"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "columbia sc"
  },
  {
    "aliases": [
      "columbus ohio"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "columbus ohio"
  },
  {
    "aliases": [
      "dayton"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "dayton"
  },
  {
    "aliases": [
      "dover"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "dover"
  },
  {
    "aliases": [
      "erie"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "erie"
  },
  {
    "aliases": [
      "evansville"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "evansville"
  },
  {
    "aliases": [
      "fort wayne"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "fort wayne"
  },
  {
    "aliases": [
      "grand rapids"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "grand rapids"
  },
  {
    "aliases": [
      "greensboro"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "greensboro"
  },
  {
    "aliases": [
      "greenville"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "greenville"
  },
  {
    "aliases": [
      "harrisburg"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "harrisburg"
  },
  {
    "aliases": [
      "hartford"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "hartford"
  },
  {
    "aliases": [
      "huntsville"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "huntsville"
  },
  {
    "aliases": [
      "indianapolis"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "indianapolis"
  },
  {
    "aliases": [
      "knoxville"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "knoxville"
  },
  {
    "aliases": [
      "lansing"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "lansing"
  },
  {
    "aliases": [
      "lexington"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "lexington"
  },
  {
    "aliases": [
      "louisville"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "louisville"
  },
  {
    "aliases": [
      "manchester nh"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "manchester nh"
  },
  {
    "aliases": [
      "montgomery"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "montgomery"
  },
  {
    "aliases": [
      "myrtle beach"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "myrtle beach"
  },
  {
    "aliases": [
      "newark"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "newark"
  },
  {
    "aliases": [
      "norfolk"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "norfolk"
  },
  {
    "aliases": [
      "providence"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "providence"
  },
  {
    "aliases": [
      "rochester"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "rochester"
  },
  {
    "aliases": [
      "savannah"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "savannah"
  },
  {
    "aliases": [
      "scranton"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "scranton"
  },
  {
    "aliases": [
      "south bend"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "south bend"
  },
  {
    "aliases": [
      "springfield il"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "springfield il"
  },
  {
    "aliases": [
      "syracuse"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "syracuse"
  },
  {
    "aliases": [
      "tallahassee"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "tallahassee"
  },
  {
    "aliases": [
      "toledo"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "toledo"
  },
  {
    "aliases": [
      "trenton"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "trenton"
  },
  {
    "aliases": [
      "wilmington"
    ],
    "timezone": "America/New_York",
    "country": "USA",
    "label": "hora Este (USA)",
    "city": "wilmington"
  },
  {
    "aliases": [
      "baton rouge"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "baton rouge"
  },
  {
    "aliases": [
      "birmingham al"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "birmingham al"
  },
  {
    "aliases": [
      "cedar rapids"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "cedar rapids"
  },
  {
    "aliases": [
      "chattanooga"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "chattanooga"
  },
  {
    "aliases": [
      "corpus christi"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "corpus christi"
  },
  {
    "aliases": [
      "des moines"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "des moines"
  },
  {
    "aliases": [
      "dubuque"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "dubuque"
  },
  {
    "aliases": [
      "evanston"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "evanston"
  },
  {
    "aliases": [
      "fargo"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "fargo"
  },
  {
    "aliases": [
      "fort worth"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "fort worth"
  },
  {
    "aliases": [
      "galveston"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "galveston"
  },
  {
    "aliases": [
      "green bay"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "green bay"
  },
  {
    "aliases": [
      "hattiesburg"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "hattiesburg"
  },
  {
    "aliases": [
      "houma"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "houma"
  },
  {
    "aliases": [
      "iowa city"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "iowa city"
  },
  {
    "aliases": [
      "jackson ms"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "jackson ms"
  },
  {
    "aliases": [
      "joplin"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "joplin"
  },
  {
    "aliases": [
      "lafayette"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "lafayette"
  },
  {
    "aliases": [
      "laredo"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "laredo"
  },
  {
    "aliases": [
      "lincoln"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "lincoln"
  },
  {
    "aliases": [
      "little rock"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "little rock"
  },
  {
    "aliases": [
      "lubbock"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "lubbock"
  },
  {
    "aliases": [
      "madison"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "madison"
  },
  {
    "aliases": [
      "mcallen"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "mcallen"
  },
  {
    "aliases": [
      "mobile"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "mobile"
  },
  {
    "aliases": [
      "montgomery al"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "montgomery al"
  },
  {
    "aliases": [
      "peoria"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "peoria"
  },
  {
    "aliases": [
      "plano"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "plano"
  },
  {
    "aliases": [
      "san angelo"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "san angelo"
  },
  {
    "aliases": [
      "shreveport"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "shreveport"
  },
  {
    "aliases": [
      "sioux falls"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "sioux falls"
  },
  {
    "aliases": [
      "springfield mo"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "springfield mo"
  },
  {
    "aliases": [
      "st paul"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "st paul"
  },
  {
    "aliases": [
      "waco"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "waco"
  },
  {
    "aliases": [
      "wichita"
    ],
    "timezone": "America/Chicago",
    "country": "USA",
    "label": "hora Central (USA)",
    "city": "wichita"
  },
  {
    "aliases": [
      "billings"
    ],
    "timezone": "America/Denver",
    "country": "USA",
    "label": "hora Montaña (USA)",
    "city": "billings"
  },
  {
    "aliases": [
      "boulder"
    ],
    "timezone": "America/Denver",
    "country": "USA",
    "label": "hora Montaña (USA)",
    "city": "boulder"
  },
  {
    "aliases": [
      "casper"
    ],
    "timezone": "America/Denver",
    "country": "USA",
    "label": "hora Montaña (USA)",
    "city": "casper"
  },
  {
    "aliases": [
      "cheyenne"
    ],
    "timezone": "America/Denver",
    "country": "USA",
    "label": "hora Montaña (USA)",
    "city": "cheyenne"
  },
  {
    "aliases": [
      "flagstaff"
    ],
    "timezone": "America/Denver",
    "country": "USA",
    "label": "hora Montaña (USA)",
    "city": "flagstaff"
  },
  {
    "aliases": [
      "grand junction"
    ],
    "timezone": "America/Denver",
    "country": "USA",
    "label": "hora Montaña (USA)",
    "city": "grand junction"
  },
  {
    "aliases": [
      "helena"
    ],
    "timezone": "America/Denver",
    "country": "USA",
    "label": "hora Montaña (USA)",
    "city": "helena"
  },
  {
    "aliases": [
      "missoula"
    ],
    "timezone": "America/Denver",
    "country": "USA",
    "label": "hora Montaña (USA)",
    "city": "missoula"
  },
  {
    "aliases": [
      "provo"
    ],
    "timezone": "America/Denver",
    "country": "USA",
    "label": "hora Montaña (USA)",
    "city": "provo"
  },
  {
    "aliases": [
      "rapid city"
    ],
    "timezone": "America/Denver",
    "country": "USA",
    "label": "hora Montaña (USA)",
    "city": "rapid city"
  },
  {
    "aliases": [
      "santa fe"
    ],
    "timezone": "America/Denver",
    "country": "USA",
    "label": "hora Montaña (USA)",
    "city": "santa fe"
  },
  {
    "aliases": [
      "scottsdale"
    ],
    "timezone": "America/Denver",
    "country": "USA",
    "label": "hora Montaña (USA)",
    "city": "scottsdale"
  },
  {
    "aliases": [
      "sedona"
    ],
    "timezone": "America/Denver",
    "country": "USA",
    "label": "hora Montaña (USA)",
    "city": "sedona"
  },
  {
    "aliases": [
      "tempe"
    ],
    "timezone": "America/Denver",
    "country": "USA",
    "label": "hora Montaña (USA)",
    "city": "tempe"
  },
  {
    "aliases": [
      "yuma"
    ],
    "timezone": "America/Denver",
    "country": "USA",
    "label": "hora Montaña (USA)",
    "city": "yuma"
  },
  {
    "aliases": [
      "bakersfield"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "bakersfield"
  },
  {
    "aliases": [
      "bellevue"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "bellevue"
  },
  {
    "aliases": [
      "berkeley"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "berkeley"
  },
  {
    "aliases": [
      "eugene"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "eugene"
  },
  {
    "aliases": [
      "everett"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "everett"
  },
  {
    "aliases": [
      "glendale"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "glendale"
  },
  {
    "aliases": [
      "honolulu"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "honolulu"
  },
  {
    "aliases": [
      "irvine"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "irvine"
  },
  {
    "aliases": [
      "mesa"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "mesa"
  },
  {
    "aliases": [
      "modesto"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "modesto"
  },
  {
    "aliases": [
      "monterey"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "monterey"
  },
  {
    "aliases": [
      "palo alto"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "palo alto"
  },
  {
    "aliases": [
      "pasadena"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "pasadena"
  },
  {
    "aliases": [
      "redding"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "redding"
  },
  {
    "aliases": [
      "reno"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "reno"
  },
  {
    "aliases": [
      "riverside"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "riverside"
  },
  {
    "aliases": [
      "salem"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "salem"
  },
  {
    "aliases": [
      "san bernardino"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "san bernardino"
  },
  {
    "aliases": [
      "santa barbara"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "santa barbara"
  },
  {
    "aliases": [
      "santa monica"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "santa monica"
  },
  {
    "aliases": [
      "santa rosa"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "santa rosa"
  },
  {
    "aliases": [
      "spokane"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "spokane"
  },
  {
    "aliases": [
      "stockton"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "stockton"
  },
  {
    "aliases": [
      "tacoma"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "tacoma"
  },
  {
    "aliases": [
      "ventura"
    ],
    "timezone": "America/Los_Angeles",
    "country": "USA",
    "label": "hora Pacífico (USA)",
    "city": "ventura"
  },
  {
    "aliases": [
      "aracaju"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "aracaju"
  },
  {
    "aliases": [
      "bauru"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "bauru"
  },
  {
    "aliases": [
      "campinas"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "campinas"
  },
  {
    "aliases": [
      "campo grande"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "campo grande"
  },
  {
    "aliases": [
      "caxias do sul"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "caxias do sul"
  },
  {
    "aliases": [
      "contagem"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "contagem"
  },
  {
    "aliases": [
      "cuiaba"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "cuiaba"
  },
  {
    "aliases": [
      "feira de santana"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "feira de santana"
  },
  {
    "aliases": [
      "joinville"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "joinville"
  },
  {
    "aliases": [
      "joao pessoa"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "joao pessoa"
  },
  {
    "aliases": [
      "juiz de fora"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "juiz de fora"
  },
  {
    "aliases": [
      "londrina"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "londrina"
  },
  {
    "aliases": [
      "maceio"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "maceio"
  },
  {
    "aliases": [
      "manaus"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "manaus"
  },
  {
    "aliases": [
      "maringa"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "maringa"
  },
  {
    "aliases": [
      "niteroi"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "niteroi"
  },
  {
    "aliases": [
      "piracicaba"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "piracicaba"
  },
  {
    "aliases": [
      "ribeirao preto"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "ribeirao preto"
  },
  {
    "aliases": [
      "santos"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "santos"
  },
  {
    "aliases": [
      "sorocaba"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "sorocaba"
  },
  {
    "aliases": [
      "teresina"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "teresina"
  },
  {
    "aliases": [
      "uberlandia"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "uberlandia"
  },
  {
    "aliases": [
      "vitoria brasil"
    ],
    "timezone": "America/Sao_Paulo",
    "country": "Brasil",
    "label": "hora Brasil",
    "city": "vitoria brasil"
  },
  {
    "aliases": [
      "albacete"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "albacete"
  },
  {
    "aliases": [
      "alicante"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "alicante"
  },
  {
    "aliases": [
      "almeria"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "almeria"
  },
  {
    "aliases": [
      "avila"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "avila"
  },
  {
    "aliases": [
      "badajoz"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "badajoz"
  },
  {
    "aliases": [
      "benidorm"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "benidorm"
  },
  {
    "aliases": [
      "burgos"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "burgos"
  },
  {
    "aliases": [
      "cadiz"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "cadiz"
  },
  {
    "aliases": [
      "castellon"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "castellon"
  },
  {
    "aliases": [
      "ceuta"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "ceuta"
  },
  {
    "aliases": [
      "ciudad real"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "ciudad real"
  },
  {
    "aliases": [
      "cuenca espana"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "cuenca espana"
  },
  {
    "aliases": [
      "elche"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "elche"
  },
  {
    "aliases": [
      "girona"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "girona"
  },
  {
    "aliases": [
      "huelva"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "huelva"
  },
  {
    "aliases": [
      "huesca"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "huesca"
  },
  {
    "aliases": [
      "ibiza"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "ibiza"
  },
  {
    "aliases": [
      "jaen"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "jaen"
  },
  {
    "aliases": [
      "la coruna"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "la coruna"
  },
  {
    "aliases": [
      "lanzarote"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "lanzarote"
  },
  {
    "aliases": [
      "leon espana"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "leon espana"
  },
  {
    "aliases": [
      "lleida"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "lleida"
  },
  {
    "aliases": [
      "logrono"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "logrono"
  },
  {
    "aliases": [
      "lorca"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "lorca"
  },
  {
    "aliases": [
      "lugo"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "lugo"
  },
  {
    "aliases": [
      "marbella"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "marbella"
  },
  {
    "aliases": [
      "melilla"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "melilla"
  },
  {
    "aliases": [
      "ourense"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "ourense"
  },
  {
    "aliases": [
      "palencia"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "palencia"
  },
  {
    "aliases": [
      "pontevedra"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "pontevedra"
  },
  {
    "aliases": [
      "sabadell"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "sabadell"
  },
  {
    "aliases": [
      "santander"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "santander"
  },
  {
    "aliases": [
      "segovia"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "segovia"
  },
  {
    "aliases": [
      "tarragona"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "tarragona"
  },
  {
    "aliases": [
      "teruel"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "teruel"
  },
  {
    "aliases": [
      "toledo espana"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "toledo espana"
  },
  {
    "aliases": [
      "torrevieja"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "torrevieja"
  },
  {
    "aliases": [
      "vitoria"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "vitoria"
  },
  {
    "aliases": [
      "zamora espana"
    ],
    "timezone": "Europe/Madrid",
    "country": "España",
    "label": "hora España",
    "city": "zamora espana"
  },
  {
    "aliases": [
      "aberdeen"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "aberdeen"
  },
  {
    "aliases": [
      "bath"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "bath"
  },
  {
    "aliases": [
      "belfast"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "belfast"
  },
  {
    "aliases": [
      "bristol"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "bristol"
  },
  {
    "aliases": [
      "cambridge uk"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "cambridge uk"
  },
  {
    "aliases": [
      "cardiff"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "cardiff"
  },
  {
    "aliases": [
      "coventry"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "coventry"
  },
  {
    "aliases": [
      "derby"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "derby"
  },
  {
    "aliases": [
      "exeter"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "exeter"
  },
  {
    "aliases": [
      "glasgow"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "glasgow"
  },
  {
    "aliases": [
      "leeds"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "leeds"
  },
  {
    "aliases": [
      "leicester"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "leicester"
  },
  {
    "aliases": [
      "newcastle"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "newcastle"
  },
  {
    "aliases": [
      "norwich"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "norwich"
  },
  {
    "aliases": [
      "nottingham"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "nottingham"
  },
  {
    "aliases": [
      "oxford"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "oxford"
  },
  {
    "aliases": [
      "plymouth"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "plymouth"
  },
  {
    "aliases": [
      "portsmouth"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "portsmouth"
  },
  {
    "aliases": [
      "sheffield"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "sheffield"
  },
  {
    "aliases": [
      "southampton"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "southampton"
  },
  {
    "aliases": [
      "stirling"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "stirling"
  },
  {
    "aliases": [
      "swansea"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "swansea"
  },
  {
    "aliases": [
      "york"
    ],
    "timezone": "Europe/London",
    "country": "Reino Unido",
    "label": "hora Londres",
    "city": "york"
  },
  {
    "aliases": [
      "aix en provence"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "aix en provence"
  },
  {
    "aliases": [
      "amiens"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "amiens"
  },
  {
    "aliases": [
      "angers"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "angers"
  },
  {
    "aliases": [
      "besancon"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "besancon"
  },
  {
    "aliases": [
      "brest"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "brest"
  },
  {
    "aliases": [
      "caen"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "caen"
  },
  {
    "aliases": [
      "cannes"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "cannes"
  },
  {
    "aliases": [
      "clermont ferrand"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "clermont ferrand"
  },
  {
    "aliases": [
      "dijon"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "dijon"
  },
  {
    "aliases": [
      "grenoble"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "grenoble"
  },
  {
    "aliases": [
      "le havre"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "le havre"
  },
  {
    "aliases": [
      "lille"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "lille"
  },
  {
    "aliases": [
      "limoges"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "limoges"
  },
  {
    "aliases": [
      "metz"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "metz"
  },
  {
    "aliases": [
      "montpellier"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "montpellier"
  },
  {
    "aliases": [
      "nancy"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "nancy"
  },
  {
    "aliases": [
      "nantes"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "nantes"
  },
  {
    "aliases": [
      "orleans"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "orleans"
  },
  {
    "aliases": [
      "reims"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "reims"
  },
  {
    "aliases": [
      "rennes"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "rennes"
  },
  {
    "aliases": [
      "rouen"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "rouen"
  },
  {
    "aliases": [
      "strasbourg"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "strasbourg"
  },
  {
    "aliases": [
      "toulon"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "toulon"
  },
  {
    "aliases": [
      "tours"
    ],
    "timezone": "Europe/Paris",
    "country": "Francia",
    "label": "hora París",
    "city": "tours"
  },
  {
    "aliases": [
      "aachen"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "aachen"
  },
  {
    "aliases": [
      "augsburg"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "augsburg"
  },
  {
    "aliases": [
      "bremen"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "bremen"
  },
  {
    "aliases": [
      "dortmund"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "dortmund"
  },
  {
    "aliases": [
      "dresden"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "dresden"
  },
  {
    "aliases": [
      "dusseldorf"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "dusseldorf"
  },
  {
    "aliases": [
      "essen"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "essen"
  },
  {
    "aliases": [
      "freiburg"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "freiburg"
  },
  {
    "aliases": [
      "hannover"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "hannover"
  },
  {
    "aliases": [
      "heidelberg"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "heidelberg"
  },
  {
    "aliases": [
      "kiel"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "kiel"
  },
  {
    "aliases": [
      "leipzig"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "leipzig"
  },
  {
    "aliases": [
      "mainz"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "mainz"
  },
  {
    "aliases": [
      "mannheim"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "mannheim"
  },
  {
    "aliases": [
      "munster"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "munster"
  },
  {
    "aliases": [
      "nuremberg"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "nuremberg"
  },
  {
    "aliases": [
      "potsdam"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "potsdam"
  },
  {
    "aliases": [
      "regensburg"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "regensburg"
  },
  {
    "aliases": [
      "rostock"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "rostock"
  },
  {
    "aliases": [
      "saarbrucken"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "saarbrucken"
  },
  {
    "aliases": [
      "wiesbaden"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "wiesbaden"
  },
  {
    "aliases": [
      "wuppertal"
    ],
    "timezone": "Europe/Berlin",
    "country": "Alemania",
    "label": "hora Berlín",
    "city": "wuppertal"
  },
  {
    "aliases": [
      "bari"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "bari"
  },
  {
    "aliases": [
      "bergamo"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "bergamo"
  },
  {
    "aliases": [
      "bologna italia"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "bologna italia"
  },
  {
    "aliases": [
      "brescia"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "brescia"
  },
  {
    "aliases": [
      "cagliari"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "cagliari"
  },
  {
    "aliases": [
      "catania"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "catania"
  },
  {
    "aliases": [
      "genova"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "genova"
  },
  {
    "aliases": [
      "lecce"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "lecce"
  },
  {
    "aliases": [
      "messina"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "messina"
  },
  {
    "aliases": [
      "modena"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "modena"
  },
  {
    "aliases": [
      "padova"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "padova"
  },
  {
    "aliases": [
      "parma"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "parma"
  },
  {
    "aliases": [
      "perugia"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "perugia"
  },
  {
    "aliases": [
      "pescara"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "pescara"
  },
  {
    "aliases": [
      "ravenna"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "ravenna"
  },
  {
    "aliases": [
      "reggio calabria"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "reggio calabria"
  },
  {
    "aliases": [
      "rimini"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "rimini"
  },
  {
    "aliases": [
      "salerno"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "salerno"
  },
  {
    "aliases": [
      "savona"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "savona"
  },
  {
    "aliases": [
      "siena"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "siena"
  },
  {
    "aliases": [
      "taranto"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "taranto"
  },
  {
    "aliases": [
      "trento"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "trento"
  },
  {
    "aliases": [
      "trieste"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "trieste"
  },
  {
    "aliases": [
      "udine"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "udine"
  },
  {
    "aliases": [
      "verona"
    ],
    "timezone": "Europe/Rome",
    "country": "Italia",
    "label": "hora Roma",
    "city": "verona"
  },
  {
    "aliases": [
      "apartado"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "apartado"
  },
  {
    "aliases": [
      "arauca city"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "arauca city"
  },
  {
    "aliases": [
      "barrancabermeja"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "barrancabermeja"
  },
  {
    "aliases": [
      "bello"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "bello"
  },
  {
    "aliases": [
      "buenaventura"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "buenaventura"
  },
  {
    "aliases": [
      "calarca"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "calarca"
  },
  {
    "aliases": [
      "cartago colombia"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "cartago colombia"
  },
  {
    "aliases": [
      "cerete"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "cerete"
  },
  {
    "aliases": [
      "chiquinquira"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "chiquinquira"
  },
  {
    "aliases": [
      "dosquebradas"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "dosquebradas"
  },
  {
    "aliases": [
      "duitama"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "duitama"
  },
  {
    "aliases": [
      "envigado"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "envigado"
  },
  {
    "aliases": [
      "facatativa"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "facatativa"
  },
  {
    "aliases": [
      "floridablanca"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "floridablanca"
  },
  {
    "aliases": [
      "fusagasuga"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "fusagasuga"
  },
  {
    "aliases": [
      "girardot"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "girardot"
  },
  {
    "aliases": [
      "giron"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "giron"
  },
  {
    "aliases": [
      "ibague city"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "ibague city"
  },
  {
    "aliases": [
      "itagui"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "itagui"
  },
  {
    "aliases": [
      "la dorada"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "la dorada"
  },
  {
    "aliases": [
      "la estrella"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "la estrella"
  },
  {
    "aliases": [
      "magangue"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "magangue"
  },
  {
    "aliases": [
      "maicao"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "maicao"
  },
  {
    "aliases": [
      "malambo"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "malambo"
  },
  {
    "aliases": [
      "manizales city"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "manizales city"
  },
  {
    "aliases": [
      "marinilla"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "marinilla"
  },
  {
    "aliases": [
      "melgar"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "melgar"
  },
  {
    "aliases": [
      "mosquera"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "mosquera"
  },
  {
    "aliases": [
      "palmira"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "palmira"
  },
  {
    "aliases": [
      "piedecuesta"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "piedecuesta"
  },
  {
    "aliases": [
      "pitalito"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "pitalito"
  },
  {
    "aliases": [
      "rionegro"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "rionegro"
  },
  {
    "aliases": [
      "sabaneta"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "sabaneta"
  },
  {
    "aliases": [
      "sahagun"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "sahagun"
  },
  {
    "aliases": [
      "san gil"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "san gil"
  },
  {
    "aliases": [
      "santa rosa de cabal"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "santa rosa de cabal"
  },
  {
    "aliases": [
      "soacha"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "soacha"
  },
  {
    "aliases": [
      "soledad"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "soledad"
  },
  {
    "aliases": [
      "tulua"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "tulua"
  },
  {
    "aliases": [
      "turbo"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "turbo"
  },
  {
    "aliases": [
      "valledupar city"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "valledupar city"
  },
  {
    "aliases": [
      "villa de leyva"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "villa de leyva"
  },
  {
    "aliases": [
      "yumbo"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "yumbo"
  },
  {
    "aliases": [
      "zipaquira"
    ],
    "timezone": "America/Bogota",
    "country": "Colombia",
    "label": "hora Bogotá",
    "city": "zipaquira"
  },
  {
    "aliases": [
      "abancay"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "abancay"
  },
  {
    "aliases": [
      "andahuaylas"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "andahuaylas"
  },
  {
    "aliases": [
      "ate"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "ate"
  },
  {
    "aliases": [
      "ayacucho city"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "ayacucho city"
  },
  {
    "aliases": [
      "barranca"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "barranca"
  },
  {
    "aliases": [
      "breña"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "breña"
  },
  {
    "aliases": [
      "callao"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "callao"
  },
  {
    "aliases": [
      "carabayllo"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "carabayllo"
  },
  {
    "aliases": [
      "cayma"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "cayma"
  },
  {
    "aliases": [
      "cerro colorado"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "cerro colorado"
  },
  {
    "aliases": [
      "chancay"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "chancay"
  },
  {
    "aliases": [
      "chincha"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "chincha"
  },
  {
    "aliases": [
      "cieneguilla"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "cieneguilla"
  },
  {
    "aliases": [
      "comas"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "comas"
  },
  {
    "aliases": [
      "cusco city"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "cusco city"
  },
  {
    "aliases": [
      "huacho"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "huacho"
  },
  {
    "aliases": [
      "huancavelica"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "huancavelica"
  },
  {
    "aliases": [
      "huanuco"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "huanuco"
  },
  {
    "aliases": [
      "ilo"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "ilo"
  },
  {
    "aliases": [
      "jaen peru"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "jaen peru"
  },
  {
    "aliases": [
      "juliaca"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "juliaca"
  },
  {
    "aliases": [
      "lambayeque"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "lambayeque"
  },
  {
    "aliases": [
      "los olivos"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "los olivos"
  },
  {
    "aliases": [
      "miraflores"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "miraflores"
  },
  {
    "aliases": [
      "moquegua"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "moquegua"
  },
  {
    "aliases": [
      "nuevo chimbote"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "nuevo chimbote"
  },
  {
    "aliases": [
      "paita"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "paita"
  },
  {
    "aliases": [
      "santiago de surco"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "santiago de surco"
  },
  {
    "aliases": [
      "sullana"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "sullana"
  },
  {
    "aliases": [
      "talara"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "talara"
  },
  {
    "aliases": [
      "tarapoto"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "tarapoto"
  },
  {
    "aliases": [
      "tingo maria"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "tingo maria"
  },
  {
    "aliases": [
      "trujillo city"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "trujillo city"
  },
  {
    "aliases": [
      "ventanilla"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "ventanilla"
  },
  {
    "aliases": [
      "villa el salvador"
    ],
    "timezone": "America/Lima",
    "country": "Perú",
    "label": "hora Lima",
    "city": "villa el salvador"
  },
  {
    "aliases": [
      "fukuoka"
    ],
    "timezone": "Asia/Tokyo",
    "country": "Japón",
    "label": "hora Tokio",
    "city": "fukuoka"
  },
  {
    "aliases": [
      "hiroshima"
    ],
    "timezone": "Asia/Tokyo",
    "country": "Japón",
    "label": "hora Tokio",
    "city": "hiroshima"
  },
  {
    "aliases": [
      "kawasaki"
    ],
    "timezone": "Asia/Tokyo",
    "country": "Japón",
    "label": "hora Tokio",
    "city": "kawasaki"
  },
  {
    "aliases": [
      "kobe"
    ],
    "timezone": "Asia/Tokyo",
    "country": "Japón",
    "label": "hora Tokio",
    "city": "kobe"
  },
  {
    "aliases": [
      "kumamoto"
    ],
    "timezone": "Asia/Tokyo",
    "country": "Japón",
    "label": "hora Tokio",
    "city": "kumamoto"
  },
  {
    "aliases": [
      "nagoya"
    ],
    "timezone": "Asia/Tokyo",
    "country": "Japón",
    "label": "hora Tokio",
    "city": "nagoya"
  },
  {
    "aliases": [
      "okinawa"
    ],
    "timezone": "Asia/Tokyo",
    "country": "Japón",
    "label": "hora Tokio",
    "city": "okinawa"
  },
  {
    "aliases": [
      "sapporo"
    ],
    "timezone": "Asia/Tokyo",
    "country": "Japón",
    "label": "hora Tokio",
    "city": "sapporo"
  },
  {
    "aliases": [
      "sendai"
    ],
    "timezone": "Asia/Tokyo",
    "country": "Japón",
    "label": "hora Tokio",
    "city": "sendai"
  },
  {
    "aliases": [
      "yokosuka"
    ],
    "timezone": "Asia/Tokyo",
    "country": "Japón",
    "label": "hora Tokio",
    "city": "yokosuka"
  },
  {
    "aliases": [
      "ahmedabad"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "ahmedabad"
  },
  {
    "aliases": [
      "bhopal"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "bhopal"
  },
  {
    "aliases": [
      "chandigarh"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "chandigarh"
  },
  {
    "aliases": [
      "coimbatore"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "coimbatore"
  },
  {
    "aliases": [
      "hyderabad"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "hyderabad"
  },
  {
    "aliases": [
      "indore"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "indore"
  },
  {
    "aliases": [
      "jaipur"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "jaipur"
  },
  {
    "aliases": [
      "kanpur"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "kanpur"
  },
  {
    "aliases": [
      "kochi"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "kochi"
  },
  {
    "aliases": [
      "lucknow"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "lucknow"
  },
  {
    "aliases": [
      "nagpur"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "nagpur"
  },
  {
    "aliases": [
      "patna"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "patna"
  },
  {
    "aliases": [
      "pune"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "pune"
  },
  {
    "aliases": [
      "surat"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "surat"
  },
  {
    "aliases": [
      "vadodara"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "vadodara"
  },
  {
    "aliases": [
      "visakhapatnam"
    ],
    "timezone": "Asia/Kolkata",
    "country": "India",
    "label": "hora India",
    "city": "visakhapatnam"
  },
  {
    "aliases": [
      "alejandria"
    ],
    "timezone": "Africa/Cairo",
    "country": "Egipto",
    "label": "hora Egipto",
    "city": "alejandria"
  },
  {
    "aliases": [
      "aswan"
    ],
    "timezone": "Africa/Cairo",
    "country": "Egipto",
    "label": "hora Egipto",
    "city": "aswan"
  },
  {
    "aliases": [
      "giza"
    ],
    "timezone": "Africa/Cairo",
    "country": "Egipto",
    "label": "hora Egipto",
    "city": "giza"
  },
  {
    "aliases": [
      "luxor"
    ],
    "timezone": "Africa/Cairo",
    "country": "Egipto",
    "label": "hora Egipto",
    "city": "luxor"
  },
  {
    "aliases": [
      "port said"
    ],
    "timezone": "Africa/Cairo",
    "country": "Egipto",
    "label": "hora Egipto",
    "city": "port said"
  },
  {
    "aliases": [
      "suez"
    ],
    "timezone": "Africa/Cairo",
    "country": "Egipto",
    "label": "hora Egipto",
    "city": "suez"
  },
  {
    "aliases": [
      "cape town"
    ],
    "timezone": "Africa/Johannesburg",
    "country": "Sudáfrica",
    "label": "hora Sudáfrica",
    "city": "cape town"
  },
  {
    "aliases": [
      "durban"
    ],
    "timezone": "Africa/Johannesburg",
    "country": "Sudáfrica",
    "label": "hora Sudáfrica",
    "city": "durban"
  },
  {
    "aliases": [
      "pretoria"
    ],
    "timezone": "Africa/Johannesburg",
    "country": "Sudáfrica",
    "label": "hora Sudáfrica",
    "city": "pretoria"
  },
  {
    "aliases": [
      "port elizabeth"
    ],
    "timezone": "Africa/Johannesburg",
    "country": "Sudáfrica",
    "label": "hora Sudáfrica",
    "city": "port elizabeth"
  },
  {
    "aliases": [
      "bloemfontein"
    ],
    "timezone": "Africa/Johannesburg",
    "country": "Sudáfrica",
    "label": "hora Sudáfrica",
    "city": "bloemfontein"
  },
  {
    "aliases": [
      "abuja"
    ],
    "timezone": "Africa/Lagos",
    "country": "Nigeria",
    "label": "hora Nigeria",
    "city": "abuja"
  },
  {
    "aliases": [
      "ibadan"
    ],
    "timezone": "Africa/Lagos",
    "country": "Nigeria",
    "label": "hora Nigeria",
    "city": "ibadan"
  },
  {
    "aliases": [
      "kano"
    ],
    "timezone": "Africa/Lagos",
    "country": "Nigeria",
    "label": "hora Nigeria",
    "city": "kano"
  },
  {
    "aliases": [
      "port harcourt"
    ],
    "timezone": "Africa/Lagos",
    "country": "Nigeria",
    "label": "hora Nigeria",
    "city": "port harcourt"
  }
];
