"""API request models and the Gemini output schemas for clarify / outline / chat edits.

Gemini schemas are kept flat (optional fields instead of unions): `response_schema` handles simple
object/array/enum shapes most reliably. Per-slide schemas are built from app/spec/layouts.json (app/services/layouts.py).
"""

from enum import Enum

from pydantic import BaseModel, Field

from .services.layouts import DESIGN, LayoutId

ThemeId = Enum("ThemeId", {t["id"]: t["id"] for t in DESIGN["builtinThemes"]}, type=str)


# ---------------------------------------------------------------- API models


class Brief(BaseModel):
    prompt: str = Field(..., min_length=3, description="Topic, requirements, source content")
    slide_count: int = Field(10, ge=3, le=30)
    audience: str | None = Field(None, max_length=200)
    purpose: str | None = Field(None, max_length=200)
    tone: str | None = Field(None, max_length=100)
    language: str = Field("English", max_length=50)
    research: bool = False


class QA(BaseModel):
    question: str
    answer: str


class OutlineItem(BaseModel):
    title: str
    layout: LayoutId
    intent: str = ""


class OutlineRequest(BaseModel):
    brief: Brief
    answers: list[QA] = []
    theme_id: str = "midnight"
    theme: dict | None = None


class GenerateRequest(BaseModel):
    title: str | None = None
    outline: list[OutlineItem] | None = None


class ChatEditRequest(BaseModel):
    message: str = Field(..., min_length=2, max_length=2000)
    current_slide: int | None = Field(None, description="0-based index of the slide the user is looking at")
    deck: dict | None = Field(None, description="Latest deck from the client (saved before editing)")


class RegenerateRequest(BaseModel):
    instruction: str | None = Field(None, max_length=1000)
    layout: LayoutId | None = None
    deck: dict | None = None


class FitRequest(BaseModel):
    attempt: int = Field(1, ge=1, le=3)
    slide: dict | None = None


class ThemePromptRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=500)
    save: bool = True


class ExportRequest(BaseModel):
    filename: str | None = Field(None, max_length=120)
    deck: dict | None = None


# ---------------------------------------------------------------- Gemini schemas


class ClarifyQuestion(BaseModel):
    question: str = Field(description="Short question for the user")
    options: list[str] = Field(description="2-4 short suggested answers")


class ClarifyResult(BaseModel):
    needs_clarification: bool = Field(description="True only if the request is too vague to build a good deck")
    questions: list[ClarifyQuestion] = Field(description="0-4 questions about audience, purpose, length or tone")


class OutlineSlideLLM(BaseModel):
    title: str = Field(description="Slide title, max ~8 words")
    layout: LayoutId
    intent: str = Field(description="One line: what this slide must communicate")


class OutlineLLM(BaseModel):
    title: str = Field(description="Deck title, max ~8 words")
    slides: list[OutlineSlideLLM]


class EditOp(str, Enum):
    update_slide = "update_slide"
    insert_slide = "insert_slide"
    delete_slide = "delete_slide"
    move_slide = "move_slide"
    update_all = "update_all"
    set_theme = "set_theme"
    rename_deck = "rename_deck"


class EditOperation(BaseModel):
    op: EditOp
    slide: int | None = Field(None, description="1-based slide number the op applies to (insert: insert AFTER this slide; 0 = at start)")
    to: int | None = Field(None, description="move_slide: 1-based target position")
    layout: LayoutId | None = Field(None, description="Layout for insert_slide, or a new layout for update_slide")
    title: str | None = Field(None, description="Title for insert_slide / rename_deck")
    instruction: str | None = Field(None, description="What to change or write (update_slide, insert_slide, update_all)")
    theme_id: ThemeId | None = Field(None, description="set_theme only")


class EditPlan(BaseModel):
    reply: str = Field(description="One or two friendly sentences telling the user what you changed")
    operations: list[EditOperation]
