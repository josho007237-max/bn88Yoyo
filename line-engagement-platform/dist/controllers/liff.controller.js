import { getLiffSettings } from '../services/liff.service';
export const liffInfo = (_req, res) => {
    res.json(getLiffSettings());
};
