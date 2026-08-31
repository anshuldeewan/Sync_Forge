import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SyncForge API' });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`API Server listening on port ${port}`);
  });
}

export default app;
