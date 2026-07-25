$ErrorActionPreference = 'Stop'
$API = 'http://localhost:3999'

function Titulo($t) { Write-Host ""; Write-Host "==> $t" -ForegroundColor Cyan }

Titulo "1) Login como 'demo'"
$login = Invoke-RestMethod -Uri "$API/users/signin" -Method Post -ContentType 'application/json' -Body '{"username":"demo","password":"secreto123"}'
Write-Host "   OK - Hola $($login.nombre) $($login.apellido) (id=$($login.id))"
$h = @{ Authorization = "Bearer $($login.token)" }

Titulo "2) Categorias raiz (publico, sin token)"
$cats = Invoke-RestMethod "$API/categorias"
foreach ($c in $cats) { Write-Host ("   [{0,2}] {1}" -f $c.id, $c.nombrecategoria) }

Titulo "3) Buscar productos que contengan 'pintura'"
$busq = Invoke-RestMethod "$API/busqueda?b=pintura" -Headers $h
Write-Host "   $($busq.Count) resultados. Primeros 5:"
$busq | Select-Object -First 5 | ForEach-Object { Write-Host ("   [{0,3}] {1}" -f $_.id, $_.nombre) }

Titulo "4) Crear un Quodom nuevo"
$q = Invoke-RestMethod -Uri "$API/quodom/create" -Method Post -Headers $h -ContentType 'application/json' -Body '{"descripcion":"Prueba manual"}'
Write-Host "   Quodom creado: id=$($q.idquodom)"

Titulo "5) Agregar una linea al Quodom (primer producto de la busqueda)"
$prod = $busq[0]
$body = @{ idquodom = $q.idquodom; idproducto = $prod.id; cantidad = 4; nombreProducto = $prod.nombre; atributo1 = 'Rojo' } | ConvertTo-Json
$linea = Invoke-RestMethod -Uri "$API/quodom_lines/add" -Method Post -Headers $h -ContentType 'application/json' -Body $body
Write-Host "   Linea agregada: id=$($linea.id)"

Titulo "6) Lineas de ESTE Quodom"
$lineas = Invoke-RestMethod "$API/quodom_lines/$($q.idquodom)" -Headers $h
foreach ($l in $lineas) { Write-Host ("   {0} x {1} ({2})" -f $l.cantidad, $l.nombreProducto, $l.atributo1) }

Titulo "7) Mis Quodoms"
$mis = Invoke-RestMethod "$API/quodom/misQuodom/" -Headers $h
foreach ($m in $mis) { Write-Host ("   {0} - {1} [{2}] - {3} productos" -f $m.nro, $m.descripcion, $m.estado, $m.cantproductos) }

Titulo "8) Generar link de WhatsApp"
$w = Invoke-RestMethod "$API/quodom/whatsapp/$($q.idquodom)" -Headers $h
Write-Host "   Link (pegalo en el navegador):" -ForegroundColor Yellow
Write-Host "   $($w.link)"
Write-Host ""
Write-Host "   Mensaje decodificado:" -ForegroundColor Yellow
[System.Uri]::UnescapeDataString($w.link.Replace('https://wa.me/?text=',''))

Titulo "9) Notificaciones internas"
$notifs = Invoke-RestMethod "$API/oper_notificaciones" -Headers $h
foreach ($n in $notifs) { Write-Host ("   [leida={0}] {1}: {2}" -f $n.leida, $n.titulo, $n.texto) }

Write-Host ""
Write-Host "==> Listo. Todo el flujo funciono end-to-end." -ForegroundColor Green
