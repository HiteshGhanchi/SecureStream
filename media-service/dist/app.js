import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
const app = express();
const port = Number(process.env.PORT ?? 8002);
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(pinoHttp());
app.get('/health', (_req, res) => {
    res.status(200).json({
        service: 'media-service',
        status: 'healthy'
    });
});
app.listen(port, '0.0.0.0', () => {
    console.log(`Media service listening on port ${port}`);
});
export { app };
//# sourceMappingURL=app.js.map