"""Name matching for Indian documents.

Indian documents often render the same name differently: "G. Venkata Ramaiah"
vs "Gundu Venkata Ramaiah" (initials), or "Sai Priya" vs "Priya Sai" (word
order). We classify a mismatch as either a benign variation (initials / word
order), a spelling variance, or evidence of a *different person*.

`names_match` normalizes using a bipartite match where a single-letter token
acts as a wildcard for any full token (covering initials in any position).
"""

from __future__ import annotations

import re

_TOKEN = re.compile(r"[a-zA-Z]+")


def tokens(name: object) -> list[str]:
    if name is None:
        return []
    return [t for t in (w.lower() for w in _TOKEN.findall(str(name))) if len(t) >= 1]


def _normalized(name: object) -> list[str]:
    """Tokens with generic common filler words removed (mr./mrs./smt. etc.)."""
    skip = {
        "mr",
        "mrs",
        "ms",
        "miss",
        "smt",
        "kum",
        "km",
        "dr",
        "s/o",
        "d/o",
        "w/o",
        "w",
        "d",
        "s",
    }
    return [t for t in tokens(name) if t not in skip]


def _can_match(a: str, b: str) -> bool:
    return a == b or len(a) == 1 or len(b) == 1


def names_match(a: object, b: object) -> bool:
    """True when two document names plausibly refer to the same person.

    Initials and word order are accepted; a genuinely different spelling
    (e.g. "Sai Pria" vs "Sai Priya") is not.
    """
    ta, tb = _normalized(a), _normalized(b)
    if not ta or not tb:
        return True  # nothing to compare; a missing name is reported elsewhere
    if ta == tb:
        return True
    if len(ta) < len(tb):
        ta, tb = tb, ta  # tb is the smaller set; greedy match over the larger

    matched = [False] * len(tb)
    for token in ta:
        for i, other in enumerate(tb):
            if not matched[i] and _can_match(token, other):
                matched[i] = True
                break
    return all(matched)


def unrelated_names(a: object, b: object) -> bool:
    """True when two names share no common token: likely different people."""
    ta, tb = set(_normalized(a)), set(_normalized(b))
    if not ta or not tb:
        return False
    return not (ta & tb)


def levenshtein(a: str, b: str) -> int:
    a, b = a.lower(), b.lower()
    if len(a) < len(b):
        a, b = b, a
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def similarity(a: object, b: object) -> float:
    """Normalized string similarity in [0, 1] for spelling messages."""
    ta, tb = " ".join(tokens(a)), " ".join(tokens(b))
    if not ta and not tb:
        return 1.0
    if not ta or not tb:
        return 0.0
    return 1.0 - levenshtein(ta, tb) / max(len(ta), len(tb))
