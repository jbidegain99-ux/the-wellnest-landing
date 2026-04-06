# Metricas Recomendadas para Wellnest Studio Dashboard
**Generado:** 2026-04-06
**Periodo de datos:** Desde inicio de operaciones hasta la fecha
**Fuente:** Auditoria directa de base de datos PostgreSQL

---

## Resumen

La base de datos contiene 323 usuarios, 278 compras, 652 reservaciones y 184 clases. Los datos son consistentes y de buena calidad. Se identificaron 15 metricas clave agrupadas en 5 categorias. Las primeras 5 metricas son "quick wins" implementables con queries simples.

---

## Datos de Referencia (Auditoria 2026-04-06)

| Indicador | Valor |
|-----------|-------|
| Usuarios totales | 323 |
| Usuarios activos (con paquete vigente) | 92 |
| Compras totales | 278 (98 activas, 180 agotadas) |
| Ordenes pagadas | 115 (todas via PayWay) |
| Ordenes pendientes (carrito abandonado) | 92 |
| Reservaciones totales | 652 (374 attended, 151 confirmed, 127 cancelled) |
| Clases programadas | 184 |
| Ingresos totales (finalPrice) | $5,867.65 |
| Compras asignadas por admin | 9 |
| Paquetes compartidos | 4 |
| Paquetes venciendo en 7 dias | 64 |

---

## Metricas Recomendadas (15)

---

### 1. Ingresos Mensuales (MoM Revenue)

- **Categoria:** Financiera
- **Descripcion:** Ingresos totales por mes, comparados con el mes anterior. Permite identificar tendencias de crecimiento o caida.
- **Formula:**
  ```sql
  SELECT DATE_TRUNC('month', "paidAt") as mes,
         SUM(total) as ingresos
  FROM "Order"
  WHERE status = 'PAID'
  GROUP BY mes
  ORDER BY mes DESC;
  ```
- **Frecuencia:** Mensual
- **Complejidad:** Simple
- **Componente:** KPI card + grafico de linea
- **Valor ejemplo:** $X,XXX.XX (mes actual vs mes anterior)
- **Insights:** Evaluar si las campanas de marketing o promociones estan generando crecimiento. Detectar estacionalidad.

---

### 2. Tasa de Retencion (30 dias)

- **Categoria:** Clientes
- **Descripcion:** Porcentaje de usuarios cuyo paquete vencio y compraron uno nuevo dentro de 30 dias. Mide lealtad del cliente.
- **Formula:**
  ```sql
  -- Usuarios con paquete expirado que compraron otro dentro de 30 dias
  SELECT
    COUNT(DISTINCT p2."userId") * 100.0 / NULLIF(COUNT(DISTINCT p1."userId"), 0) as retention_rate
  FROM "Purchase" p1
  JOIN "Purchase" p2 ON p1."userId" = p2."userId"
    AND p2."createdAt" > p1."expiresAt"
    AND p2."createdAt" <= p1."expiresAt" + INTERVAL '30 days'
  WHERE p1.status IN ('EXPIRED', 'DEPLETED');
  ```
- **Frecuencia:** Mensual
- **Complejidad:** Media
- **Componente:** KPI card con porcentaje + tendencia
- **Insights:** Si la retencion es baja, evaluar programas de renovacion automatica, descuentos por renovacion, o mejorar la experiencia de clase.

---

### 3. Tasa de Asistencia vs No-Shows

- **Categoria:** Engagement
- **Descripcion:** Porcentaje de reservaciones donde el usuario asistio vs. no asistio o cancelo. Mide compromiso real.
- **Formula:**
  ```sql
  SELECT
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
  FROM "Reservation"
  GROUP BY status;
  ```
- **Frecuencia:** Semanal
- **Complejidad:** Simple
- **Componente:** Grafico de dona o barras
- **Valor ejemplo:** ATTENDED: 374 (57.4%), CONFIRMED: 151 (23.2%), CANCELLED: 127 (19.5%)
- **Insights:** Si no-shows son altos, considerar: politica de cancelacion mas estricta, recordatorios por WhatsApp/email, o penalizacion de clases.

---

### 4. Tasa de Ocupacion por Clase

- **Categoria:** Operaciones
- **Descripcion:** Porcentaje promedio de cupos llenados por clase. Identifica clases subutilizadas o sobrecargadas.
- **Formula:**
  ```sql
  SELECT
    d.name as disciplina,
    AVG(c."currentCount" * 100.0 / NULLIF(c."maxCapacity", 0)) as ocupacion_promedio,
    COUNT(c.id) as total_clases
  FROM "Class" c
  JOIN "Discipline" d ON c."disciplineId" = d.id
  WHERE c."isCancelled" = false
  GROUP BY d.name
  ORDER BY ocupacion_promedio DESC;
  ```
- **Frecuencia:** Semanal
- **Complejidad:** Simple
- **Componente:** Tabla con barras de progreso por disciplina
- **Insights:** Clases con baja ocupacion: evaluar cambio de horario o reduccion de frecuencia. Clases llenas: considerar agregar sesiones adicionales.

---

### 5. Paquetes Mas Vendidos

- **Categoria:** Producto
- **Descripcion:** Ranking de paquetes por numero de compras y por ingresos generados.
- **Formula:**
  ```sql
  SELECT
    pk.name,
    COUNT(p.id) as ventas,
    SUM(p."finalPrice") as ingresos_totales,
    AVG(p."finalPrice") as ticket_promedio
  FROM "Purchase" p
  JOIN "Package" pk ON p."packageId" = pk.id
  GROUP BY pk.name
  ORDER BY ventas DESC;
  ```
- **Frecuencia:** Mensual
- **Complejidad:** Simple
- **Componente:** Tabla con ranking
- **Insights:** Identificar productos estrella y productos a descontinuar. Optimizar precios basado en demanda.

---

### 6. Valor de Vida del Cliente (CLV)

- **Categoria:** Clientes
- **Descripcion:** Promedio total gastado por un cliente durante toda su relacion con Wellnest.
- **Formula:**
  ```sql
  SELECT
    AVG(total_spent) as clv_promedio,
    MAX(total_spent) as clv_maximo,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_spent) as clv_mediana
  FROM (
    SELECT "userId", SUM("finalPrice") as total_spent
    FROM "Purchase"
    GROUP BY "userId"
  ) sub;
  ```
- **Frecuencia:** Mensual
- **Complejidad:** Simple
- **Componente:** KPI card
- **Insights:** Comparar CLV con costo de adquisicion. Usuarios con alto CLV son candidatos para programas de fidelidad.

---

### 7. Nuevos Clientes por Mes

- **Categoria:** Clientes
- **Descripcion:** Cantidad de usuarios nuevos que realizan su primera compra cada mes.
- **Formula:**
  ```sql
  SELECT
    DATE_TRUNC('month', MIN(p."createdAt")) as primer_compra_mes,
    COUNT(DISTINCT p."userId") as nuevos_clientes
  FROM "Purchase" p
  GROUP BY p."userId"
  ORDER BY primer_compra_mes DESC;
  -- Luego agrupar por mes
  ```
- **Frecuencia:** Mensual
- **Complejidad:** Media
- **Componente:** Grafico de barras (mensual)
- **Insights:** Medir efectividad de marketing. Correlacionar con campanas especificas o eventos.

---

### 8. Tasa de Conversion Prueba a Pago

- **Categoria:** Clientes
- **Descripcion:** Porcentaje de usuarios que compraron un paquete de prueba ("Clase de Prueba") y luego compraron un paquete pago.
- **Formula:**
  ```sql
  SELECT
    COUNT(DISTINCT CASE WHEN has_paid THEN trial_user END) * 100.0
      / NULLIF(COUNT(DISTINCT trial_user), 0) as conversion_rate
  FROM (
    SELECT
      p."userId" as trial_user,
      EXISTS(
        SELECT 1 FROM "Purchase" p2
        JOIN "Package" pk2 ON p2."packageId" = pk2.id
        WHERE p2."userId" = p."userId"
        AND pk2.name != 'Clase de Prueba'
      ) as has_paid
    FROM "Purchase" p
    JOIN "Package" pk ON p."packageId" = pk.id
    WHERE pk.name = 'Clase de Prueba'
  ) sub;
  ```
- **Frecuencia:** Mensual
- **Complejidad:** Media
- **Componente:** KPI card con porcentaje
- **Insights:** Metrica critica para el funnel. Si es baja, mejorar la experiencia de la primera clase o hacer seguimiento post-prueba.

---

### 9. Utilizacion de Paquete

- **Categoria:** Engagement
- **Descripcion:** Porcentaje promedio de clases utilizadas de un paquete antes de que expire.
- **Formula:**
  ```sql
  SELECT
    pk.name,
    AVG(
      (pk."classCount" - p."classesRemaining") * 100.0 / NULLIF(pk."classCount", 0)
    ) as utilizacion_promedio
  FROM "Purchase" p
  JOIN "Package" pk ON p."packageId" = pk.id
  WHERE p.status IN ('EXPIRED', 'DEPLETED')
  GROUP BY pk.name
  ORDER BY utilizacion_promedio DESC;
  ```
- **Frecuencia:** Mensual
- **Complejidad:** Simple
- **Componente:** Tabla con barras de progreso
- **Insights:** Baja utilizacion sugiere que los paquetes son demasiado grandes o los horarios no convenientes. Alta utilizacion sugiere oportunidad de upsell.

---

### 10. Ingresos por Disciplina

- **Categoria:** Financiera
- **Descripcion:** Desglose de ingresos por disciplina (Yoga, Pilates, Pole Sport, etc.).
- **Formula:**
  ```sql
  SELECT
    d.name as disciplina,
    COUNT(DISTINCT r."userId") as usuarios_unicos,
    COUNT(r.id) as total_reservas
  FROM "Reservation" r
  JOIN "Class" c ON r."classId" = c.id
  JOIN "Discipline" d ON c."disciplineId" = d.id
  WHERE r.status IN ('CONFIRMED', 'ATTENDED')
  GROUP BY d.name
  ORDER BY total_reservas DESC;
  ```
- **Frecuencia:** Mensual
- **Complejidad:** Simple
- **Componente:** Grafico de barras horizontal
- **Insights:** Identificar disciplinas estrella para invertir mas (mejores instructores, mas horarios) y disciplinas debiles.

---

### 11. Tasa de Compra Repetida

- **Categoria:** Clientes
- **Descripcion:** Porcentaje de usuarios que han comprado 2 o mas paquetes.
- **Formula:**
  ```sql
  SELECT
    COUNT(CASE WHEN purchase_count >= 2 THEN 1 END) * 100.0
      / NULLIF(COUNT(*), 0) as repeat_rate
  FROM (
    SELECT "userId", COUNT(*) as purchase_count
    FROM "Purchase"
    GROUP BY "userId"
  ) sub;
  ```
- **Frecuencia:** Mensual
- **Complejidad:** Simple
- **Componente:** KPI card
- **Insights:** Benchmark de lealtad. Comparar con la industria (tipicamente 30-40% para estudios de wellness).

---

### 12. Horarios Pico (Peak Hours)

- **Categoria:** Operaciones
- **Descripcion:** Distribucion de reservaciones por hora del dia y dia de la semana.
- **Formula:**
  ```sql
  SELECT
    EXTRACT(DOW FROM c."dateTime" AT TIME ZONE 'America/El_Salvador') as dia_semana,
    EXTRACT(HOUR FROM c."dateTime" AT TIME ZONE 'America/El_Salvador') as hora,
    COUNT(r.id) as total_reservas
  FROM "Reservation" r
  JOIN "Class" c ON r."classId" = c.id
  WHERE r.status IN ('CONFIRMED', 'ATTENDED')
  GROUP BY dia_semana, hora
  ORDER BY total_reservas DESC;
  ```
- **Frecuencia:** Semanal
- **Complejidad:** Simple
- **Componente:** Heatmap (dia x hora)
- **Insights:** Optimizar horarios de clases. Identificar ventanas de baja demanda para promociones especiales.

---

### 13. Rendimiento por Instructor

- **Categoria:** Operaciones
- **Descripcion:** Reservaciones por instructor, tasa de asistencia, y ocupacion promedio.
- **Formula:**
  ```sql
  SELECT
    i.name as instructor,
    COUNT(DISTINCT c.id) as clases_dadas,
    COUNT(r.id) as total_reservas,
    AVG(c."currentCount" * 100.0 / NULLIF(c."maxCapacity", 0)) as ocupacion_promedio
  FROM "Instructor" i
  JOIN "Class" c ON c."instructorId" = i.id
  LEFT JOIN "Reservation" r ON r."classId" = c.id AND r.status IN ('CONFIRMED', 'ATTENDED')
  WHERE c."isCancelled" = false
  GROUP BY i.name
  ORDER BY total_reservas DESC;
  ```
- **Frecuencia:** Mensual
- **Complejidad:** Media
- **Componente:** Tabla con ranking
- **Insights:** Identificar instructores estrella para retener. Detectar instructores con baja demanda para capacitacion o reasignacion.

---

### 14. Carritos Abandonados

- **Categoria:** Financiera
- **Descripcion:** Ordenes en estado PENDING que nunca se completaron. Representa ingresos perdidos potenciales.
- **Formula:**
  ```sql
  SELECT
    COUNT(*) as carritos_abandonados,
    SUM(total) as ingresos_perdidos_potenciales,
    DATE_TRUNC('month', "createdAt") as mes
  FROM "Order"
  WHERE status = 'PENDING'
  GROUP BY mes
  ORDER BY mes DESC;
  ```
- **Frecuencia:** Semanal
- **Complejidad:** Simple
- **Componente:** KPI card + tabla mensual
- **Valor ejemplo:** 92 ordenes pendientes en el sistema
- **Insights:** Implementar emails de recuperacion de carrito. Analizar en que paso del checkout abandonan.

---

### 15. Ingresos por Metodo de Pago

- **Categoria:** Financiera
- **Descripcion:** Desglose de ingresos por metodo de pago (PayWay vs. Offline/Admin-assigned).
- **Formula:**
  ```sql
  SELECT
    CASE WHEN "paymentProviderId" IS NOT NULL THEN 'PayWay' ELSE 'Offline' END as metodo,
    COUNT(*) as cantidad,
    SUM("finalPrice") as total_ingresos
  FROM "Purchase"
  GROUP BY metodo;
  ```
- **Frecuencia:** Mensual
- **Complejidad:** Simple
- **Componente:** Grafico de dona
- **Insights:** Monitorear la proporcion de ventas offline vs. online. Alto offline puede indicar que el proceso de pago online tiene fricciones.

---

## Metricas No Recomendadas (Brechas de Datos)

| Metrica | Razon |
|---------|-------|
| Costo de Adquisicion de Cliente (CAC) | No hay datos de gasto en marketing |
| Net Promoter Score (NPS) | No hay encuestas de satisfaccion |
| Tasa de cancelacion por instructor | Cancelaciones no distinguen entre usuario e instructor |
| Datos de tarjeta (brand, last4) | PayWay no esta enviando estos datos correctamente |
| Revenue por referido | Sistema de referidos tiene datos limitados (PENDING mostly) |

---

## Calidad de Datos

| Aspecto | Estado |
|---------|--------|
| Timestamps (createdAt, updatedAt) | Completos y confiables |
| payment_method tracking | Parcial: solo PayWay vs null (no Stripe activo) |
| Attendance tracking | Bueno: 4 estados (CONFIRMED, ATTENDED, CANCELLED, NO_SHOW) |
| Soft deletes | No implementado en User (hard delete con cascade) |
| Expiration dates | Presentes y precisos |
| Discount codes | Tracking completo (code + porcentaje + usos) |

---

## Plan de Implementacion (Priorizado)

### Quick Wins (1-2 horas cada una)
1. **Carritos abandonados** — simple count, alto impacto revenue
2. **Tasa de asistencia** — ya tenemos los datos, solo visualizar
3. **Paquetes mas vendidos** — query directa, tabla simple
4. **Ocupacion por clase** — identifica problemas operativos
5. **Ingresos por metodo de pago** — visibilidad financiera basica

### Fase 2 (3-4 horas total)
6. **Ingresos mensuales (MoM)** — requiere grafico de linea
7. **Nuevos clientes por mes** — funnel tracking
8. **Conversion prueba a pago** — metrica critica del funnel
9. **Horarios pico** — requiere heatmap component

### Fase 3 (4-6 horas total)
10. **Tasa de retencion** — query compleja con joins temporales
11. **CLV** — necesita acumulacion historica
12. **Utilizacion de paquete** — analisis de paquetes expirados
13. **Rendimiento por instructor** — dashboard operativo
14. **Tasa de compra repetida** — segmentacion de clientes
15. **Ingresos por disciplina** — desglose financiero detallado
