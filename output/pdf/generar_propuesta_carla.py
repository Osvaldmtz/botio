from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).parent
OUT = ROOT / 'propuesta-colaboracion-kalyo-carla-munoz.pdf'
PURPLE = '#7C3DE3'
DARK = '#5B21B6'
INK = '#1A1A2E'
MUTED = '#64748B'
W, H = 595.28, 841.89
c = canvas.Canvas(str(OUT), pagesize=(W,H))
c.setTitle('Kalyo | Propuesta de colaboración para Carla Muñoz')
c.setAuthor('Kalyo')

def p(text, x, top, width, size=10, color=INK, bold=False, leading=None):
    style = ParagraphStyle('p', fontName='Helvetica-Bold' if bold else 'Helvetica', fontSize=size, leading=leading or size*1.42, textColor=HexColor(color))
    para = Paragraph(text, style)
    _, height = para.wrap(width, H)
    para.drawOn(c, x, H-top-height)
    return top+height

def base(page, label):
    c.setFillColor(HexColor(PURPLE)); c.rect(0,H-7,W,7,fill=1,stroke=0)
    c.drawImage('/Users/OsvaMtz/kalyo-landing/assets/kalyo-logo.png',42,H-83,width=107,height=45.33,mask='auto')
    p('PROPUESTA DE COLABORACIÓN',325,42,230,8.5,MUTED,True)
    p('30 de septiembre de 2026',325,59,230,9,MUTED)
    c.setStrokeColor(HexColor('#E9E2F6')); c.line(42,57,W-42,57)
    p('KALYO  /  kalyo.io',42,H-43,280,8.5,DARK,True)
    p(f'{label}  ·  {page}/2',365,H-43,195,8,MUTED)

def section(title,text,top):
    top=p(title,42,top,511,12,DARK,True)
    return p(text,42,top+7,511,10.3)+17

base(1,'Contenido y colaboración')
p('Crezcamos juntos',42,119,511,29,DARK,True)
p('Una colaboración entre Kalyo y Carla Muñoz',42,162,511,13,MUTED)
p('Carla, queremos construir contigo una colaboración basada en tu experiencia usando Kalyo: compartir usos reales de la plataforma y acercarla a otros psicólogos que puedan beneficiarse de ella.',42,199,511,11)

for x,big,small in [(42,'6 meses','de colaboración inicial'),(216,'30 %','de comisión recurrente'),(390,'Tu experiencia','como punto de partida')]:
    c.setFillColor(HexColor('#F8F7FF')); c.roundRect(x,H-333,163,75,9,fill=1,stroke=0)
    p(big,x+12,271,139,19 if x<390 else 13,DARK,True)
    p(small,x+12,304,139,8.5,MUTED)

t=section('01  Lo que te ofrece Kalyo','Acceso individual gratuito durante seis meses al plan que acordemos, acompañado de orientación para aprovechar la plataforma y preparar las demostraciones. También contarás con un enlace o código personal para recomendar Kalyo y generar comisiones.',355)
t=section('02  Contenido que proponemos','<b>Un video mensual (seis en total)</b> sobre tu experiencia o una función que utilices en tu práctica, publicado en tu perfil y mencionando a Kalyo.<br/><br/><b>Dos secuencias de historias al mes (doce en total)</b>, de dos a tres historias cada una, con una invitación a conocer la plataforma mediante tu enlace de referido.',t)
t=section('03  Una propuesta que podemos construir contigo','Estas cantidades son un punto de partida. Nos gustaría conocer qué formatos funcionan mejor con tu comunidad y acordar un calendario que se adapte a tu estilo. Revisaremos el avance al tercer mes y la posible continuidad al finalizar el sexto.',t)
p('El acceso gratuito se vincula al cumplimiento del contenido acordado. La comisión por referidos se gestiona de forma independiente.',42,t,511,9,MUTED)
c.showPage()

base(2,'Programa de referidos')
p('Tus recomendaciones,',42,119,511,27,DARK,True)
p('ingresos recurrentes',42,153,511,27,DARK,True)
p('30 % por cada nuevo cliente referido que pague su suscripción',42,199,511,12,INK,True)

t=section('04  Cómo funciona tu comisión','Recibirás el <b>30 % del importe de suscripción efectivamente cobrado</b> a cada nuevo cliente atribuido a tu enlace o código, después de descuentos, sin impuestos y descontando devoluciones. Los registros y las pruebas gratuitas no generan comisión.',240)
t=section('05  Por cuánto tiempo','La comisión continuará <b>mientras el cliente referido mantenga su suscripción de pago activa</b>, incluso después de finalizar los seis meses de colaboración. Si deja de pagar, no se generan nuevas comisiones mientras no existan nuevos cobros.',t)
t=section('06  Cómo recibirás tus pagos','Proponemos una <b>liquidación mensual con reporte de los cobros y comisiones atribuidos</b>. Podemos conversar sobre tu forma de pago preferida. Evaluaremos la automatización mediante Stripe si resulta compatible con los países, las cuentas y la configuración requerida; esta opción queda sujeta a validación.',t)
t=section('07  Uso del contenido y acuerdos finales','Nos gustaría republicar tus videos en los canales propios de Kalyo, con tu crédito y permiso, durante un plazo que acordemos. El uso en anuncios pagados se autorizará por separado. Las demostraciones utilizarán datos ficticios, sin información de pacientes.',t)
p('Antes de comenzar, dejaremos por escrito el plan incluido, la fecha de inicio, el calendario, los permisos de uso y las reglas de atribución, cancelaciones, reactivaciones, planes anuales y costos de transferencia.',42,t,511,9.2,MUTED)
t+=62
c.setFillColor(HexColor('#F8F7FF')); c.roundRect(42,H-t-68,511,68,9,fill=1,stroke=0)
p('¿Cómo te gustaría organizar esta colaboración?',56,t+12,483,12,DARK,True)
p('Queremos escuchar tus ideas y acordar una propuesta que funcione para ambos.',56,t+34,483,10,INK)
p('Propuesta para conversar. Condiciones sujetas a acuerdo entre ambas partes.',42,758,511,8,MUTED)
c.save()
print(OUT)
