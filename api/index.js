import app from '../server/src/index.js';

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

export default function handler(req, res) {
  return app(req, res);
}
