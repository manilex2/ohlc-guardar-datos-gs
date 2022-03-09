require('dotenv').config();
const mysql = require('mysql2');
const { database } = require('./keys');
const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: 'https://www.googleapis.com/auth/spreadsheets'
});

exports.handler = async function (event) {
    const promise = new Promise(async function() {
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
                close FROM ${tabla}`;
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
                await googleSheet.spreadsheets.values.clear({
                    auth,
                    spreadsheetId,
                    range: `${hoja}`
                });
                let fecha = new Date(resultado[0].fecha);
                let mes = fecha.getMonth() + 1;
                fecha = fecha.getFullYear() + '-' + mes + '-' + fecha.getDate();
                let datos = [];
                datos.push([
                    resultado[0].name,
                    fecha,
                    resultado[0].open,
                    resultado[0].high,
                    resultado[0].low,
                    resultado[0].close
                ])
                for (let i = 0; i < resultado.length; i++) {
                    let fechaArray = new Date(resultado[i].fecha);
                    let mesArray = fechaArray.getMonth() + 1;;
                    fechaArray = fechaArray.getFullYear() + '-' + mesArray + '-' + fechaArray.getDate();
                    if (fecha != fechaArray) {
                        datos.push([
                            resultado[i].name,
                            fechaArray,
                            resultado[i].open,
                            resultado[i].high,
                            resultado[i].low,
                            resultado[i].close
                        ]);
                        fecha = fechaArray;
                    }
                }
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
        }
    });
    return promise;
};