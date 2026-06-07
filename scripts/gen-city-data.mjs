import { writeFileSync } from 'node:fs';

const groups = [
  { aliases: ['cdmx','ciudad de mexico','mexico df','mexico city','df','distrito federal'], timezone: 'America/Mexico_City', country: 'México', label: 'hora CDMX', city: 'CDMX' },
  { aliases: ['mexicali','tijuana','ensenada','rosarito','tecate','mexicalli'], timezone: 'America/Tijuana', country: 'México', label: 'hora Pacífico', city: 'Mexicali' },
  { aliases: ['cancun','playa del carmen','tulum','cozumel','isla mujeres','chetumal'], timezone: 'America/Cancun', country: 'México', label: 'hora Cancún', city: 'Cancún' },
  { aliases: ['culiacan','los mochis','mazatlan','guasave','navojoa sinaloa'], timezone: 'America/Mazatlan', country: 'México', label: 'hora Mazatlán', city: 'Culiacán' },
  { aliases: ['hermosillo','sonora','ciudad obregon','guaymas','navojoa','nogales','magdalena'], timezone: 'America/Hermosillo', country: 'México', label: 'hora Sonora', city: 'Hermosillo' },
  { aliases: ['chihuahua','juarez','ciudad juarez','delicias','parral','cuauhtemoc','ojinaga'], timezone: 'America/Chihuahua', country: 'México', label: 'hora Chihuahua', city: 'Chihuahua' },
  { aliases: ['monterrey','saltillo','torreon','monclova','piedras negras','nuevo laredo','reynosa','matamoros','ciudad victoria'], timezone: 'America/Monterrey', country: 'México', label: 'hora Monterrey', city: 'Monterrey' },
  { aliases: ['guadalajara','puerto vallarta','leon','queretaro','puebla','merida','oaxaca','veracruz','acapulco','morelia','aguascalientes','san luis potosi','pachuca','toluca','cuernavaca','tlaxcala','tepic','colima','villahermosa','tuxtla gutierrez','campeche','chilpancingo','durango','zacatecas','tampico','ciudad madero','coatzacoalcos','tapachula','ixtapa','zihuatanejo','taxco','cuautla','salamanca','irapuato','celaya','fresnillo','manzanillo'], timezone: 'America/Mexico_City', country: 'México', label: 'hora CDMX', city: 'Guadalajara' },
  { aliases: ['bogota','cali','medellin','barranquilla','cartagena','bucaramanga','pereira','manizales','ibague','cucuta','santa marta','pasto','monteria','armenia','sincelejo','popayan','valledupar','neiva','florencia','villavicencio','tunja','riohacha','quibdo','leticia','mocoa','yopal','arauca','mitu','puerto carreno','san andres','inirida','san jose del guaviare'], timezone: 'America/Bogota', country: 'Colombia', label: 'hora Bogotá', city: 'Bogotá' },
  { aliases: ['lima','limaaaa','arequipa','trujillo','cusco','chiclayo','piura','iquitos','huancayo','tacna','ica','puno','chimbote','ayacucho','cajamarca','pucallpa','huaraz','tumbes'], timezone: 'America/Lima', country: 'Perú', label: 'hora Lima', city: 'Lima' },
  { aliases: ['buenos aires','caba','cordoba','rosario','mendoza','la plata','mar del plata','tucuman','salta','santa fe','san juan','resistencia','corrientes','posadas','bahia blanca','neuquen','formosa','la rioja','comodoro rivadavia','rio gallegos','ushuaia','jujuy'], timezone: 'America/Argentina/Buenos_Aires', country: 'Argentina', label: 'hora Argentina', city: 'Buenos Aires' },
  { aliases: ['santiago','santiago de chile','valparaiso','concepcion','la serena','antofagasta','temuco','rancagua','iquique','arica','puerto montt','punta arenas','chillan','osorno','valdivia','calama','copiapo'], timezone: 'America/Santiago', country: 'Chile', label: 'hora Chile', city: 'Santiago' },
  { aliases: ['montevideo','punta del este','salto','paysandu','maldonado','colonia','rivera','tacuarembo'], timezone: 'America/Montevideo', country: 'Uruguay', label: 'hora Uruguay', city: 'Montevideo' },
  { aliases: ['caracas','maracaibo','valencia','barquisimeto','maracay','ciudad guayana','san cristobal','maturin','ciudad bolivar','cumana','merida venezuela','barinas','porlamar','puerto la cruz'], timezone: 'America/Caracas', country: 'Venezuela', label: 'hora Venezuela', city: 'Caracas' },
  { aliases: ['quito','guayaquil','cuenca','santo domingo de los tsachilas','machala','manta','portoviejo','ambato','riobamba','loja','esmeraldas','ibarra'], timezone: 'America/Guayaquil', country: 'Ecuador', label: 'hora Ecuador', city: 'Quito' },
  { aliases: ['la paz','santa cruz','cochabamba','sucre','oruro','potosi','tarija','trinidad bolivia','cobija','el alto'], timezone: 'America/La_Paz', country: 'Bolivia', label: 'hora Bolivia', city: 'La Paz' },
  { aliases: ['asuncion','ciudad del este','encarnacion','pedro juan caballero','concepcion paraguay'], timezone: 'America/Asuncion', country: 'Paraguay', label: 'hora Paraguay', city: 'Asunción' },
  { aliases: ['guatemala','ciudad de guatemala','antigua guatemala','quetzaltenango','escuintla'], timezone: 'America/Guatemala', country: 'Guatemala', label: 'hora Guatemala', city: 'Guatemala' },
  { aliases: ['san salvador','santa ana','san miguel'], timezone: 'America/El_Salvador', country: 'El Salvador', label: 'hora El Salvador', city: 'San Salvador' },
  { aliases: ['tegucigalpa','san pedro sula','la ceiba','choloma'], timezone: 'America/Tegucigalpa', country: 'Honduras', label: 'hora Honduras', city: 'Tegucigalpa' },
  { aliases: ['managua','leon nicaragua','masaya','granada nicaragua','chinandega','matagalpa'], timezone: 'America/Managua', country: 'Nicaragua', label: 'hora Nicaragua', city: 'Managua' },
  { aliases: ['san jose costa rica','alajuela','cartago','heredia','puntarenas','liberia costa rica'], timezone: 'America/Costa_Rica', country: 'Costa Rica', label: 'hora Costa Rica', city: 'San José' },
  { aliases: ['panama','ciudad de panama','colon panama','david'], timezone: 'America/Panama', country: 'Panamá', label: 'hora Panamá', city: 'Panamá' },
  { aliases: ['santo domingo','punta cana','santiago de los caballeros','san pedro de macoris','la romana','puerto plata'], timezone: 'America/Santo_Domingo', country: 'República Dominicana', label: 'hora Dominicana', city: 'Santo Domingo' },
  { aliases: ['la habana','havana','habana','santiago de cuba','camaguey','holguin','guantanamo','matanzas','varadero'], timezone: 'America/Havana', country: 'Cuba', label: 'hora Cuba', city: 'La Habana' },
  { aliases: ['san juan puerto rico','puerto rico','ponce','bayamon','caguas','mayaguez'], timezone: 'America/Puerto_Rico', country: 'Puerto Rico', label: 'hora Puerto Rico', city: 'San Juan' },
  { aliases: ['new york','nueva york','nyc','miami','orlando','tampa','atlanta','washington','boston','philadelphia','pittsburgh','detroit','cleveland','cincinnati','jacksonville','fort lauderdale','raleigh','charlotte','baltimore','richmond'], timezone: 'America/New_York', country: 'USA', label: 'hora Este (USA)', city: 'New York' },
  { aliases: ['chicago','dallas','houston','san antonio','austin','nashville','new orleans','minneapolis','memphis','milwaukee','st louis','kansas city','oklahoma city','tulsa','omaha'], timezone: 'America/Chicago', country: 'USA', label: 'hora Central (USA)', city: 'Chicago' },
  { aliases: ['denver','salt lake city','phoenix','albuquerque','el paso','tucson','colorado springs','boise'], timezone: 'America/Denver', country: 'USA', label: 'hora Montaña (USA)', city: 'Denver' },
  { aliases: ['los angeles','la usa','san francisco','sf usa','san diego','sacramento','seattle','portland','las vegas','long beach','oakland','fresno','san jose usa','anaheim'], timezone: 'America/Los_Angeles', country: 'USA', label: 'hora Pacífico (USA)', city: 'Los Angeles' },
  { aliases: ['toronto','ottawa','montreal','quebec','halifax canada'], timezone: 'America/Toronto', country: 'Canadá', label: 'hora Toronto', city: 'Toronto' },
  { aliases: ['vancouver','victoria canada'], timezone: 'America/Vancouver', country: 'Canadá', label: 'hora Vancouver', city: 'Vancouver' },
  { aliases: ['calgary','edmonton'], timezone: 'America/Edmonton', country: 'Canadá', label: 'hora Calgary', city: 'Calgary' },
  { aliases: ['winnipeg'], timezone: 'America/Winnipeg', country: 'Canadá', label: 'hora Winnipeg', city: 'Winnipeg' },
  { aliases: ['sao paulo','rio de janeiro','brasilia','salvador brasil','fortaleza','belo horizonte','curitiba','recife','porto alegre','belem','goiania','natal','florianopolis'], timezone: 'America/Sao_Paulo', country: 'Brasil', label: 'hora Brasil', city: 'São Paulo' },
  { aliases: ['madrid','barcelona','sevilla','valencia espana','bilbao','malaga','zaragoza','palma','palma de mallorca','las palmas','murcia','granada espana','cordoba espana','valladolid','vigo','gijon','a coruña','oviedo','pamplona','salamanca'], timezone: 'Europe/Madrid', country: 'España', label: 'hora España', city: 'Madrid' },
  { aliases: ['londres','london','manchester','liverpool','birmingham','edinburgh','edimburgo','dublin'], timezone: 'Europe/London', country: 'Reino Unido', label: 'hora Londres', city: 'Londres' },
  { aliases: ['paris','lyon','marseille','marsella','toulouse','nice','niza','bordeaux'], timezone: 'Europe/Paris', country: 'Francia', label: 'hora París', city: 'París' },
  { aliases: ['berlin','munich','hamburg','hamburgo','frankfurt','cologne','colonia','stuttgart'], timezone: 'Europe/Berlin', country: 'Alemania', label: 'hora Berlín', city: 'Berlín' },
  { aliases: ['roma','rome','milan','napoles','napoli','turin','palermo','florencia','florence','bologna','bolonia','venecia','venice'], timezone: 'Europe/Rome', country: 'Italia', label: 'hora Roma', city: 'Roma' },
  { aliases: ['amsterdam','rotterdam','la haya','utrecht'], timezone: 'Europe/Amsterdam', country: 'Países Bajos', label: 'hora Amsterdam', city: 'Amsterdam' },
  { aliases: ['lisboa','lisbon','porto','oporto','coimbra','braga','faro'], timezone: 'Europe/Lisbon', country: 'Portugal', label: 'hora Lisboa', city: 'Lisboa' },
  { aliases: ['bruselas','brussels','brujas','antwerp','amberes'], timezone: 'Europe/Brussels', country: 'Bélgica', label: 'hora Bruselas', city: 'Bruselas' },
  { aliases: ['zurich','ginebra','basel','basilea','berna'], timezone: 'Europe/Zurich', country: 'Suiza', label: 'hora Suiza', city: 'Zúrich' },
  { aliases: ['viena','vienna','salzburgo','graz'], timezone: 'Europe/Vienna', country: 'Austria', label: 'hora Viena', city: 'Viena' },
  { aliases: ['estocolmo','stockholm','goteborg'], timezone: 'Europe/Stockholm', country: 'Suecia', label: 'hora Estocolmo', city: 'Estocolmo' },
  { aliases: ['oslo','bergen'], timezone: 'Europe/Oslo', country: 'Noruega', label: 'hora Oslo', city: 'Oslo' },
  { aliases: ['copenhague','copenhagen','aarhus'], timezone: 'Europe/Copenhagen', country: 'Dinamarca', label: 'hora Copenhague', city: 'Copenhague' },
  { aliases: ['helsinki','turku'], timezone: 'Europe/Helsinki', country: 'Finlandia', label: 'hora Helsinki', city: 'Helsinki' },
  { aliases: ['varsovia','warsaw','krakow','cracovia'], timezone: 'Europe/Warsaw', country: 'Polonia', label: 'hora Varsovia', city: 'Varsovia' },
  { aliases: ['atenas','athens','thessaloniki','salonica'], timezone: 'Europe/Athens', country: 'Grecia', label: 'hora Atenas', city: 'Atenas' },
  { aliases: ['moscu','moscow','san petersburgo'], timezone: 'Europe/Moscow', country: 'Rusia', label: 'hora Moscú', city: 'Moscú' },
  { aliases: ['estambul','istanbul','ankara'], timezone: 'Europe/Istanbul', country: 'Turquía', label: 'hora Estambul', city: 'Estambul' },
  { aliases: ['tokyo','tokio','osaka','kyoto','kioto','yokohama'], timezone: 'Asia/Tokyo', country: 'Japón', label: 'hora Tokio', city: 'Tokio' },
  { aliases: ['hong kong'], timezone: 'Asia/Hong_Kong', country: 'Hong Kong', label: 'hora Hong Kong', city: 'Hong Kong' },
  { aliases: ['singapur','singapore'], timezone: 'Asia/Singapore', country: 'Singapur', label: 'hora Singapur', city: 'Singapur' },
  { aliases: ['shanghai','beijing','pekin'], timezone: 'Asia/Shanghai', country: 'China', label: 'hora China', city: 'Shanghái' },
  { aliases: ['seul','seoul','busan'], timezone: 'Asia/Seoul', country: 'Corea del Sur', label: 'hora Seúl', city: 'Seúl' },
  { aliases: ['mumbai','bombay','delhi','nueva delhi','bangalore','chennai','kolkata'], timezone: 'Asia/Kolkata', country: 'India', label: 'hora India', city: 'Mumbai' },
  { aliases: ['bangkok'], timezone: 'Asia/Bangkok', country: 'Tailandia', label: 'hora Bangkok', city: 'Bangkok' },
  { aliases: ['dubai','abu dhabi'], timezone: 'Asia/Dubai', country: 'EAU', label: 'hora Dubai', city: 'Dubai' },
  { aliases: ['sydney','melbourne','brisbane','perth australia'], timezone: 'Australia/Sydney', country: 'Australia', label: 'hora Sydney', city: 'Sydney' },
];

// Expand to 500+ with additional cities
const extra = {
  'America/Mexico_City': { country: 'México', label: 'hora CDMX', cities: ['apizaco','atlixco','campeche city','cholula','ciudad valles','comitan','cordoba mexico','cosamaloapan','cuautitlan','ecatepec','guanajuato','huajuapan','huatulco','ixtlahuaca','jilotepec','jiutepec','jojutla','la piedad','lazaro cardenas','linares','minatitlan','miramar','moroleon','naucalpan','ocotlan','ocoyoacac','ometepec','orizaba','poza rica','progreso','puerto escondido','puerto penasco','salamanca mexico','san cristobal de las casas','san juan del rio','san luis rio colorado','san martin texmelucan','santa catarina','santa rosa jauregui','silao','tehuacan','tehuantepec','temixco','tenancingo','texcoco','tlalnepantla','tlaxcoapan','tula de allende','uruapan','xalapa','zacapoaxtla','zacatepec','zamora mexico','zinacantepec'] },
  'America/Tijuana': { country: 'México', label: 'hora Pacífico', cities: ['la paz baja california','loreto','los cabos','san felipe','san quintin','san ysidro','valle de guadalupe'] },
  'America/New_York': { country: 'USA', label: 'hora Este (USA)', cities: ['albany','allentown','ann arbor','annapolis','asheville','augusta','burlington','cambridge usa','canton','charleston','columbia sc','columbus ohio','dayton','dover','erie','evansville','fort wayne','grand rapids','greensboro','greenville','harrisburg','hartford','huntsville','indianapolis','knoxville','lansing','lexington','louisville','manchester nh','montgomery','myrtle beach','newark','norfolk','providence','rochester','savannah','scranton','south bend','springfield il','syracuse','tallahassee','toledo','trenton','wilmington'] },
  'America/Chicago': { country: 'USA', label: 'hora Central (USA)', cities: ['baton rouge','birmingham al','cedar rapids','chattanooga','corpus christi','des moines','dubuque','evanston','fargo','fort worth','galveston','green bay','hattiesburg','houma','iowa city','jackson ms','joplin','lafayette','laredo','lincoln','little rock','lubbock','madison','mcallen','mobile','montgomery al','peoria','plano','san angelo','shreveport','sioux falls','springfield mo','st paul','waco','wichita'] },
  'America/Denver': { country: 'USA', label: 'hora Montaña (USA)', cities: ['billings','boulder','casper','cheyenne','flagstaff','grand junction','helena','missoula','provo','rapid city','santa fe','scottsdale','sedona','tempe','yuma'] },
  'America/Los_Angeles': { country: 'USA', label: 'hora Pacífico (USA)', cities: ['bakersfield','bellevue','berkeley','eugene','everett','glendale','honolulu','irvine','mesa','modesto','monterey','palo alto','pasadena','redding','reno','riverside','salem','san bernardino','santa barbara','santa monica','santa rosa','spokane','stockton','tacoma','ventura'] },
  'America/Sao_Paulo': { country: 'Brasil', label: 'hora Brasil', cities: ['aracaju','bauru','campinas','campo grande','caxias do sul','contagem','cuiaba','feira de santana','joinville','joao pessoa','juiz de fora','londrina','maceio','manaus','maringa','niteroi','piracicaba','ribeirao preto','santos','sorocaba','teresina','uberlandia','vitoria brasil'] },
  'Europe/Madrid': { country: 'España', label: 'hora España', cities: ['albacete','alicante','almeria','avila','badajoz','benidorm','burgos','cadiz','castellon','ceuta','ciudad real','cuenca espana','elche','girona','huelva','huesca','ibiza','jaen','la coruna','lanzarote','leon espana','lleida','logrono','lorca','lugo','marbella','melilla','ourense','palencia','pontevedra','sabadell','santander','segovia','tarragona','teruel','toledo espana','torrevieja','vitoria','zamora espana'] },
  'Europe/London': { country: 'Reino Unido', label: 'hora Londres', cities: ['aberdeen','bath','belfast','bristol','cambridge uk','cardiff','coventry','derby','exeter','glasgow','leeds','leicester','newcastle','norwich','nottingham','oxford','plymouth','portsmouth','sheffield','southampton','stirling','swansea','york'] },
  'Europe/Paris': { country: 'Francia', label: 'hora París', cities: ['aix en provence','amiens','angers','besancon','brest','caen','cannes','clermont ferrand','dijon','grenoble','le havre','lille','limoges','metz','montpellier','nancy','nantes','orleans','reims','rennes','rouen','strasbourg','toulon','tours'] },
  'Europe/Berlin': { country: 'Alemania', label: 'hora Berlín', cities: ['aachen','augsburg','bremen','dortmund','dresden','dusseldorf','essen','freiburg','hannover','heidelberg','kiel','leipzig','mainz','mannheim','munster','nuremberg','potsdam','regensburg','rostock','saarbrucken','wiesbaden','wuppertal'] },
  'Europe/Rome': { country: 'Italia', label: 'hora Roma', cities: ['bari','bergamo','bologna italia','brescia','cagliari','catania','genova','lecce','messina','modena','padova','parma','perugia','pescara','ravenna','reggio calabria','rimini','salerno','savona','siena','taranto','trento','trieste','udine','verona'] },
  'America/Bogota': { country: 'Colombia', label: 'hora Bogotá', cities: ['apartado','arauca city','barrancabermeja','bello','buenaventura','calarca','cartago colombia','cerete','chiquinquira','dosquebradas','duitama','envigado','facatativa','floridablanca','fusagasuga','girardot','giron','ibague city','itagui','la dorada','la estrella','magangue','maicao','malambo','manizales city','marinilla','melgar','mosquera','palmira','piedecuesta','pitalito','rionegro','sabaneta','sahagun','san gil','santa rosa de cabal','soacha','soledad','tulua','turbo','valledupar city','villa de leyva','yumbo','zipaquira'] },
  'America/Lima': { country: 'Perú', label: 'hora Lima', cities: ['abancay','andahuaylas','ate','ayacucho city','barranca','breña','callao','carabayllo','cayma','cerro colorado','chancay','chincha','cieneguilla','comas','cusco city','huacho','huancavelica','huanuco','ilo','jaen peru','juliaca','lambayeque','los olivos','miraflores','moquegua','nuevo chimbote','paita','santiago de surco','sullana','talara','tarapoto','tingo maria','trujillo city','ventanilla','villa el salvador'] },
  'Asia/Tokyo': { country: 'Japón', label: 'hora Tokio', cities: ['fukuoka','hiroshima','kawasaki','kobe','kumamoto','nagoya','okinawa','sapporo','sendai','yokosuka'] },
  'Asia/Kolkata': { country: 'India', label: 'hora India', cities: ['ahmedabad','bhopal','chandigarh','coimbatore','hyderabad','indore','jaipur','kanpur','kochi','lucknow','nagpur','patna','pune','surat','vadodara','visakhapatnam'] },
  'Africa/Cairo': { country: 'Egipto', label: 'hora Egipto', cities: ['alejandria','aswan','giza','luxor','port said','suez'] },
  'Africa/Johannesburg': { country: 'Sudáfrica', label: 'hora Sudáfrica', cities: ['cape town','durban','pretoria','port elizabeth','bloemfontein'] },
  'Africa/Lagos': { country: 'Nigeria', label: 'hora Nigeria', cities: ['abuja','ibadan','kano','port harcourt'] },
};

for (const [tz, meta] of Object.entries(extra)) {
  for (const city of meta.cities) {
    groups.push({ aliases: [city], timezone: tz, country: meta.country, label: meta.label, city: city });
  }
}

const totalAliases = groups.reduce((n, g) => n + g.aliases.length, 0);
const out = `export type CityTimezoneEntry = {
  aliases: string[];
  timezone: string;
  country: string;
  label: string;
  city: string;
};

export const CITY_TIMEZONE_ENTRIES: CityTimezoneEntry[] = ${JSON.stringify(groups, null, 2)};
`;
writeFileSync('lib/city-timezone-data.ts', out);
console.log('entries:', groups.length, 'aliases:', totalAliases);
