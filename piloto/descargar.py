"""
Piloto automático · paso 1: baja precios de Yahoo Finance y los guarda en sitio/datos/precios.json.
Lo corre GitHub Actions; no necesitas ejecutarlo tú.
"""
import json
import os
import sys
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import pandas as pd
import yfinance as yf

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SALIDA = os.path.join(RAIZ, "sitio", "datos", "precios.json")

# id, clave en Yahoo, nombre, sector, moneda. Agrega o quita las que quieras.
MERCADOS = {
    "rapido": {
        "zona": "America/New_York", "abre": (9, 30), "cierra": (16, 0), "retraso": 0,
        "emisoras": [
            ("EWW", "EWW", "iShares MSCI México", "ETF", "USD"),
            ("AMX", "AMX", "América Móvil", "Telecom", "USD"),
            ("CX", "CX", "Cemex", "Construcción", "USD"),
            ("FMX", "FMX", "FEMSA", "Bebidas y comercio", "USD"),
            ("KOF", "KOF", "Coca-Cola FEMSA", "Bebidas", "USD"),
            ("ASR", "ASR", "Grupo Aeroportuario del Sureste", "Aeropuertos", "USD"),
            ("PAC", "PAC", "Grupo Aeroportuario del Pacífico", "Aeropuertos", "USD"),
            ("OMAB", "OMAB", "Grupo Aeroportuario Centro Norte", "Aeropuertos", "USD"),
        ],
    },
    "bmv": {
        "zona": "America/Mexico_City", "abre": (8, 30), "cierra": (15, 0), "retraso": 20,
        "emisoras": [
            ("IPC", "^MXX", "S&P/BMV IPC", "Índice", "MXN"),
            ("WALMEX", "WALMEX.MX", "Walmart de México", "Autoservicio", "MXN"),
            ("GFNORTEO", "GFNORTEO.MX", "Grupo Financiero Banorte", "Banca", "MXN"),
            ("AMXB", "AMXB.MX", "América Móvil", "Telecom", "MXN"),
            ("CEMEXCPO", "CEMEXCPO.MX", "Cemex", "Construcción", "MXN"),
            ("GMEXICOB", "GMEXICOB.MX", "Grupo México", "Minería", "MXN"),
            ("FEMSAUBD", "FEMSAUBD.MX", "FEMSA", "Bebidas y comercio", "MXN"),
            ("BIMBOA", "BIMBOA.MX", "Grupo Bimbo", "Alimentos", "MXN"),
        ],
    },
}


def tabla(datos, clave, varias):
    if datos is None or datos.empty:
        return None
    if isinstance(datos.columns, pd.MultiIndex):
        if clave in datos.columns.get_level_values(0):
            df = datos[clave]
        elif clave in datos.columns.get_level_values(1):
            df = datos.xs(clave, axis=1, level=1)
        elif not varias:
            df = datos.copy()
            df.columns = datos.columns.get_level_values(0)
        else:
            return None
    else:
        df = datos
    return df.dropna(subset=["Close"])


def bajar(claves, intentos=4, **kw):
    """Yahoo a veces rechaza peticiones desde la nube; se reintenta con pausas."""
    for intento in range(intentos):
        try:
            datos = yf.download(claves, group_by="ticker", progress=False, threads=True, **kw)
            if datos is not None and not datos.empty:
                return datos
        except Exception as e:
            print(f"Intento {intento + 1} falló: {e}")
        time.sleep(15 * (intento + 1))
    return None


def estado(m):
    ahora = datetime.now(ZoneInfo(m["zona"]))
    hm = (ahora.hour, ahora.minute)
    habil = ahora.weekday() < 5
    return {"estado": "abierto" if habil and m["abre"] <= hm < m["cierra"] else "cerrado",
            "hoy": ahora.date().isoformat(), "despuesDelCierre": habil and hm >= m["cierra"],
            "retraso": m["retraso"], "abre": "%02d:%02d" % m["abre"], "cierra": "%02d:%02d" % m["cierra"]}


def main():
    salida = {"generado": datetime.now(ZoneInfo("America/Mexico_City")).isoformat(), "mercados": {}, "series": [], "fallas": []}
    for modo, m in MERCADOS.items():
        salida["mercados"][modo] = estado(m)
        claves = [e[1] for e in m["emisoras"]]
        diario = bajar(claves, period="5y", interval="1d", auto_adjust=True)
        minuto = bajar(claves, period="1d", interval="1m", auto_adjust=False, prepost=False)
        zona = ZoneInfo(m["zona"])
        for ident, clave, nombre, sector, moneda in m["emisoras"]:
            df = tabla(diario, clave, len(claves) > 1)
            if df is None or len(df) < 300:
                salida["fallas"].append(ident)
                continue
            df = df[df["Close"] > 0]
            aperturas = df["Open"].where(df["Open"] > 0, df["Close"])
            fechas = [d.strftime("%Y-%m-%d") for d in df.index]
            c = [round(float(x), 4) for x in df["Close"]]
            o = [round(float(x), 4) for x in aperturas]
            intr = tabla(minuto, clave, len(claves) > 1)
            if intr is not None and len(intr):
                idx = intr.index.tz_convert(zona) if intr.index.tz is not None else intr.index.tz_localize("UTC").tz_convert(zona)
                cierres = [round(float(x), 4) for x in intr["Close"]]
                cot = {"precio": cierres[-1], "apertura": round(float(intr["Open"].dropna().iloc[0]), 4),
                       "hora": idx[-1].isoformat(), "fecha": idx[-1].date().isoformat(), "puntos": cierres[::5] + [cierres[-1]]}
            else:
                cot = {"precio": c[-1], "apertura": o[-1], "hora": fechas[-1] + "T00:00:00", "fecha": fechas[-1], "puntos": c[-20:]}
            anteriores = [i for i, f in enumerate(fechas) if f < cot["fecha"]]
            cot["cierreAnt"] = c[anteriores[-1]] if anteriores else cot["precio"]
            salida["series"].append({"modo": modo, "id": ident, "nombre": nombre, "sector": sector, "moneda": moneda,
                                     "fechas": fechas, "o": o, "c": c, "cot": cot})
    # tipo de cambio para poder sumar en pesos lo que se opera en dólares (si no llega, la sala muestra cada moneda aparte)
    fx = tabla(bajar("MXN=X", intentos=2, period="5d", interval="1d", auto_adjust=False), "MXN=X", False)
    if fx is not None and len(fx):
        salida["tipoCambio"] = {"usdmxn": round(float(fx["Close"].iloc[-1]), 4), "fecha": fx.index[-1].strftime("%Y-%m-%d")}
    if not salida["series"]:
        print("No llegó ningún precio de Yahoo; el piloto no corre esta vez.")
        sys.exit(1)
    os.makedirs(os.path.dirname(SALIDA), exist_ok=True)
    with open(SALIDA, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Precios listos: {len(salida['series'])} series. Fallaron: {salida['fallas'] or 'ninguna'}")


if __name__ == "__main__":
    main()
