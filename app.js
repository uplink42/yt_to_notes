const fs = require('fs');
const ytdl = require("@distube/ytdl-core");
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const FormData = require('form-data');

const videoURL = 'https://www.youtube.com/watch?v=LkLwNQGu4iY';

// Your authorization bearer token
const token = '';

const videoPath = path.join(__dirname, `video.mp3`);
const audioPath = path.join(__dirname, 'audio.mp3');

downloadAndProcess(videoURL, videoPath, (err) => {
    convertAndCompress(videoPath, audioPath, (err) => {
        createTranscript();
    });
});

// convertAndCompress('video.mp4', audioPath, (err) => {
//     if (err) {
//         console.error('Failed to convert and compress the file:', err);
//     } else {
//         console.log('Process completed successfully.');
//     }
// });

function downloadAndProcess(url, videoPath, callback) {
    console.log('START DOWNLOAD');
    const videoStream = ytdl(url, { quality: 'highestaudio' });

    videoStream.pipe(fs.createWriteStream(videoPath))
        .on('finish', () => {
            console.log('Download complete.');
            callback();
        })
        .on('error', (err) => {
            console.error('Error during download:', err);
            callback(err);
        });
}

function convertAndCompress(inputFilePath, outputFilePath, callback) {
    ffmpeg(inputFilePath)
        .audioBitrate('32k') // Adjust this value to set the desired bitrate
        .save(outputFilePath)
        .on('start', (commandLine) => {
            console.log('FFmpeg command: ', commandLine);
        })
        .on('progress', (progress) => {
            console.log('Processing: ', progress);
        })
        .on('error', (err) => {
            console.log('An error occurred: ', err.message);
        })
        .on('end', () => {
            console.log('Processing finished !');
            callback();
        });
}

function createTranscript() {
    console.log('CREATE TRANSCRIPT');
    // Define the API endpoint
    const apiUrl = 'https://api.openai.com/v1/audio/transcriptions';

    // Path to the audio file
    const audioFilePath = path.join(__dirname, 'audio.mp3');

    // Create a form-data instance
    const form = new FormData();
    form.append('file', fs.createReadStream(audioFilePath));
    form.append('model', 'whisper-1');


    // Set the headers required for the request, including the form's headers
    const headers = {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
    };

    // Perform the POST request
    axios.post(apiUrl, form, { headers, timeout: 500000 })
        .then(response => {
            console.log('TRANSCRIPT DONE!');
            console.log(response.data);
            if (!response.data.text) {
                console.log('ERROR');
                return;
            }

            queryGPT(response.data.text);

        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function queryGPT(response) {
    const completionUrl = 'https://api.openai.com/v1/chat/completions';

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    let data = {
        model: 'gpt-4o', // Change this if you're using a different model
        messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: 'From the following transcript, tell me what the video was about, and its main points. Make sure to explain things in detail:' + response }
            // { role: 'user', content: 'Com base na transcrição de um webinar, vais identificar os temas abordados, os interlocutores e efetuar um breve resumo dos eventos principais da apresentação. Conteúdos do webinar:' + response }
        ],
        temperature: 0.5
    };

    axios.post(completionUrl, JSON.stringify(data), { headers, timeout: 500000 }).then(response => {
        console.log('TEXT DONE!');
        console.log(response.data);

        fs.writeFileSync('result_' + uuidv4() + '.txt', JSON.stringify(response.data.choices[0].message.content));
    });
}