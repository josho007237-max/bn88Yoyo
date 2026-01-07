import { LineMessaging } from '../services/lineMessaging.service';
import { store } from '../store/memoryStore';
export const groupSummary = async (_req, res) => {
    const groups = Array.from(store.groups.entries()).map(([id, g]) => ({ id, ...g }));
    res.json({ groups });
};
export const postToGroup = async (req, res) => {
    const { groupId, messages } = req.body;
    await LineMessaging.push(groupId, messages);
    res.json({ ok: true });
};
