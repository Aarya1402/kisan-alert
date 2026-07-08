import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { api } from './routes/api.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api', api);
app.get('/', (_req, res) => res.json({ service: 'Kisan Alert API', docs: '/api/health' }));

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`🌾 Kisan Alert API on http://localhost:${port}`));
