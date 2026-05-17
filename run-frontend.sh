#!/bin/bash

# Script para iniciar el servidor del frontend en Linux/Mac

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║  Playas de Autos - Frontend Server                 ║"
echo "║  Iniciando en puerto 3000...                       ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")"

# Iniciar servidor Python
python3 server.py

if [ $? -ne 0 ]; then
    echo ""
    echo "Error: No se pudo iniciar el servidor"
    echo "Verifica que Python 3 esté instalado"
fi
