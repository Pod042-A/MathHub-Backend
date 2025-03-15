import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
const router = express.Router();
// 根據 questId 取得與該名稱相同、位於quests目錄的 JSON 檔案
// 獲取 JSON 檔案中的題目，傳送到前端頁面
// URL 範例：http://localhost:5001/quest/getQuest/A01
router.get("/getQuest/:questId", (req, res) => {
    const questId = req.params.questId;
    try {
        const filepath = path.resolve(`./quests/${questId}.json`);
        if (!fs.existsSync(filepath)) {
            throw new Error("Quest not found!");
        }
        const fileContent = fs.readFileSync(filepath, 'utf-8');
        const fileQuest = JSON.parse(fileContent);
        res.status(200).json({ "題目": fileQuest.題目 });
    }
    catch (error) {
        console.error(error);
        res.status(404).send(error);
    }
});
// 使用 query string 方法傳送解答到後端伺服器
// 比較題目檔案中的答案，並返回結果
// URL 範例：http://localhost:5001/quest/answerQuest/A01?answer=2
router.get("/answerQuest/:questId", (req, res) => {
    const questId = req.params.questId;
    const answer = req.query.answer;
    try {
        const filepath = path.resolve(`./quests/${questId}.json`);
        if (!fs.existsSync(filepath)) {
            throw new Error("Quest not found!");
        }
        const fileContent = fs.readFileSync(filepath, 'utf-8');
        const fileQuest = JSON.parse(fileContent);
        if (answer === fileQuest.答案) {
            res.status(200).send('正確');
        }
        else {
            res.status(200).send('錯誤');
        }
    }
    catch (error) {
        console.error(error);
        res.status(404).send(error);
    }
});
router.get("/", (req, res) => {
    res.send("Quest Page");
});
export default router;
