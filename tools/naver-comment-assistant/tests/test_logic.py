import sys, unittest, tempfile, os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import comment_assistant as ca

class CommentAssistantTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old = ca.HOME, ca.DB, ca.CONFIG
        ca.HOME = Path(self.tmp.name)
        ca.DB = ca.HOME / "comments.sqlite3"
        ca.CONFIG = ca.HOME / "settings.json"
        ca.setup()

    def tearDown(self):
        ca.HOME, ca.DB, ca.CONFIG = self.old
        self.tmp.cleanup()

    def test_duplicate_is_blocked(self):
        ca.add_item("own", "독자", "질문", "https://blog.naver.com/test/1", "리뷰 잘 봤습니다!")
        with self.assertRaisesRegex(ValueError, "이미 등록"):
            ca.add_item("own", "다른 독자", "다른 제목", "https://blog.naver.com/test/1", "리뷰 잘 봤습니다!")

    def test_neighbor_requires_specific_text(self):
        with self.assertRaisesRegex(ValueError, "40자"):
            ca.add_item("neighbor", "이웃", "여행", "", "멋져요")

    def test_redaction_and_prompt(self):
        ca.add_item("own", "고객", "질문", "", "연락처 010-1234-5678로 전화 부탁드립니다.")
        with ca.connect() as db:
            row = db.execute("SELECT * FROM comments").fetchone()
        prompt = ca.prompt_for(row)
        self.assertNotIn("010-1234-5678", prompt)
        self.assertIn("[전화번호 삭제]", prompt)

    def test_manual_generation_no_api(self):
        ca.add_item("own", "독자", "소감", "", "잘 읽고 갑니다. 감사합니다!")
        msg=ca.generate_one(1)
        self.assertIn("프롬프트", msg)
        with ca.connect() as db:
            row=db.execute("SELECT * FROM comments WHERE id=1").fetchone()
        self.assertEqual("프롬프트",row["status"])
        self.assertIn("현장 | 명지대장",row["prompt"])
        self.assertTrue(ca.export().exists())

    def test_draft_warnings(self):
        self.assertIn("홍보", ca.warning_for("제 블로그에 오세요 https://example.com"))
        self.assertEqual("", ca.warning_for("읽어주셔서 고맙습니다. 문의해 주신 내용은 확인하겠습니다."))

    def test_daily_limit_prevents_duplicate_processing(self):
        ca.add_item("own", "a", "제목1", "", "첫 번째 문의 내용이 있습니다.")
        ca.add_item("own", "b", "제목2", "", "두 번째 문의 내용이 있습니다.")
        config=ca.settings(); config["daily_limit"]=1; ca.store_settings(config)
        ca.daily()
        with ca.connect() as db:
            counts = {r["status"]:r["n"] for r in db.execute("SELECT status,count(*) n FROM comments GROUP BY status")}
        self.assertEqual(1,counts["프롬프트"])
        self.assertEqual(1,counts["대기"])

if __name__ == "__main__":
    unittest.main()
