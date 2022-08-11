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
    await obtenerOHLC(process.env.TABLE_OHLC_MIN, process.env.ID_HOJA_RANGO1);
    await finalizarEjecucion();
    async function obtenerOHLC(tabla, hoja){
        try {
            const spreadsheetId1 = process.env.SPREADSHEET_ID_CP1_MIN;
            const spreadsheetId2 = process.env.SPREADSHEET_ID_CP2_MIN;
            var fechaActual = new Date();
            var fechaFiltro = new Date();
            var fechaFiltro = fechaFiltro.setDate(fechaActual.getDate()-4);
            fechaFiltro = new Date(fechaFiltro);
            fechaActual = `${fechaActual.getFullYear()}-${fechaActual.getMonth()+1}-${fechaActual.getDate()}T${fechaActual.getHours()}:${fechaActual.getMinutes()}:${fechaActual.getSeconds()}.000Z`;
            fechaFiltro = `${fechaFiltro.getFullYear()}-${fechaFiltro.getMonth()+1}-${fechaFiltro.getDate()}T${fechaFiltro.getHours()}:${fechaFiltro.getMinutes()}:${fechaFiltro.getSeconds()}.000Z`;

            var sql = `SELECT name,
            fecha,
            open, 
            high,
            low,
            close FROM ${tabla} WHERE fecha BETWEEN "${fechaFiltro}" AND "${fechaActual}" ORDER BY name, fecha DESC`;
            console.log(fechaActual, fechaFiltro)
            conexion.query(sql, async function (err, resultado) {
                if (err) throw err;
                JSON.stringify(resultado);
                trasladarOHLC(resultado, hoja, spreadsheetId1);
                await trasladarOHLC(resultado, hoja, spreadsheetId2);
            });
        } catch (error) {
            console.error(error);
        }
    };
    
    async function trasladarOHLC(resultado, hoja, spreadsheetId){
        try {
            var datos = [];
            for (let i = 0; i < resultado.length; i++) {
                let fecha = new Date(resultado[i].fecha);
                let mes = fecha.getMonth() + 1;
                fecha = `${fecha.getFullYear()}-${mes}-${fecha.getDate()} ${fecha.getHours()}:${fecha.getMinutes()}:${fecha.getSeconds()}`;
                let name = resultado[i].name;
                let open = resultado[i].open;
                let high = resultado[i].high;
                let low = resultado[i].low;
                let close = resultado[i].close;
                datos.push([
                    name,
                    fecha,
                    open,
                    high,
                    low,
                    close
                ]);
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