require('dotenv').config();
const express = require('express');
const morgan = require('morgan');
const mysql = require('mysql2');
const { database } = require('./keys');
const PUERTO = 4300;
const app = express();
const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: 'https://www.googleapis.com/auth/spreadsheets'
});

app.use(morgan('dev'));

app.get('/', async (req, res) => {
    const conexion = mysql.createConnection({
        host: database.host,
        user: database.user,
        password: database.password,
        port: database.port,
        database: database.database
    });
    const client = await auth.getClient();
    const googleSheet = google.sheets({ version: 'v4', auth: client });
    await obtenerOHLC(process.env.TABLE_OHLC_HORA, process.env.ID_HOJA_RANGO2);
    await obtenerOHLC(process.env.TABLE_OHLC_DIA, process.env.ID_HOJA_RANGO3);
    await finalizarEjecucion();
    async function obtenerOHLC(tabla, hoja){
        try {
            const spreadsheetId1 = process.env.SPREADSHEET_ID_CP1;
            const spreadsheetId2 = process.env.SPREADSHEET_ID_CP2;
            const spreadsheetId3 = process.env.SPREADSHEET_ID_CP3;
            var sql = `SELECT name,
            fecha,
            open, 
            high,
            low,
            close FROM ${tabla} ORDER BY name, fecha DESC`;
            conexion.query(sql, async function (err, resultado) {
                if (err) throw err;
                JSON.stringify(resultado);
                trasladarOHLC(resultado, hoja, spreadsheetId1);
                await trasladarOHLC(resultado, hoja, spreadsheetId2);
                await trasladarOHLC(resultado, hoja, spreadsheetId3);
            });
        } catch (error) {
            console.error(error);
        }
    };
    
    async function trasladarOHLC(resultado, hoja, spreadsheetId){
        try {
            let fecha = new Date(resultado[0].fecha);
            let mes = fecha.getMonth() + 1;
            fecha = fecha.getFullYear() + '-' + mes + '-' + fecha.getDate();
            let name = resultado[0].name;
            let open = resultado[0].open;
            let high = resultado[0].high;
            let low = resultado[0].low;
            let close = resultado[0].close;
            let datos = [];
            datos.push([
                name,
                fecha,
                open,
                high,
                low,
                close
            ]);
            for (let i = 0; i < resultado.length; i++) {
                let fechaArray = new Date(resultado[i].fecha);
                let mesArray = fechaArray.getMonth() + 1;
                fechaArray = fechaArray.getFullYear() + '-' + mesArray + '-' + fechaArray.getDate();
                if ((name == resultado[i].name && fecha != fechaArray) && (open != resultado[i].open || high != resultado[i].high || low != resultado[i].low || close != resultado[i].close)) {
                    datos.push([
                        resultado[i].name,
                        fechaArray,
                        resultado[i].open,
                        resultado[i].high,
                        resultado[i].low,
                        resultado[i].close
                    ]);
                    name = resultado[i].name;
                    fecha = fechaArray;
                    open = resultado[i].open;
                    high = resultado[i].high;
                    low = resultado[i].low;
                    close = resultado[i].close;
                }
                if ((name != resultado[i].name && fecha != fechaArray) && (open != resultado[i].open || high != resultado[i].high || low != resultado[i].low || close != resultado[i].close)) {
                    datos.push([
                        resultado[i].name,
                        fechaArray,
                        resultado[i].open,
                        resultado[i].high,
                        resultado[i].low,
                        resultado[i].close
                    ]);
                    name = resultado[i].name;
                    fecha = fechaArray;
                    open = resultado[i].open;
                    high = resultado[i].high;
                    low = resultado[i].low;
                    close = resultado[i].close;
                }
            }
            await googleSheet.spreadsheets.values.clear({
                auth,
                spreadsheetId,
                range: `${hoja}`
            });
            await googleSheet.spreadsheets.values.append({
                auth,
                spreadsheetId,
                range: `${hoja}`,
                valueInputOption: "USER_ENTERED",
                requestBody: {
                    "range": `${hoja}`,
                    "values": datos
                }
            });
            console.log('Datos agregados correctamente.');
        } catch (error) {
            console.error(error);
        }
    };
    async function finalizarEjecucion() {
        conexion.end();
        res.send("Ejecutado");
    }
});

app.listen(process.env.PORT || PUERTO, () => {
    console.log(`Escuchando en puerto ${process.env.PORT || PUERTO}`);
});