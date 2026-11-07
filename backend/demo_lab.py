"""Built-in example lab for DEMO mode (no API key, or VIVA_DEMO=1).

The quiz below was written by hand for exactly this manual + code. Demo mode never generates
questions for other materials. Options are listed with the correct one first here; the server
shuffles them for every quiz.
"""

MANUAL_FILENAME = "lab4_word_frequencies.md"
MANUAL = """# Lab 4: Word Frequencies

## 1. Objectives
By the end of this lab you should be able to:
- use a dictionary to count occurrences;
- normalise text before processing it;
- sort with a custom key function;
- write small functions with default arguments.

## 2. Background: counting with dictionaries
A dictionary maps keys to values. To count items, use each item as a key and its count as the value.
`dict.get(key, default)` returns `default` when the key is missing, which avoids a `KeyError` the
first time you see an item. Counting n words this way takes O(n) time, because each dictionary
lookup and update takes constant time on average.

## 3. Background: sorting with a key
`sorted(iterable, key=f)` sorts items by `f(item)` instead of by the items themselves. It returns a
new list and leaves the original unchanged. Tuples compare element by element: a key that returns a
tuple sorts by the first element and only uses the second element to break ties. Sorting m items
takes O(m log m) time.

## 4. Task
Write `top_words(text, n=3)` that returns the `n` most frequent words in `text` as a list of
`(word, count)` tuples.

## 5. Requirements
- R1. Words are separated by whitespace.
- R2. Ignore case: "The" and "the" are the same word.
- R3. Ignore punctuation at the start or end of a word ("sat," counts as "sat").
- R4. Tokens that are empty after removing punctuation must not be counted.
- R5. Order by count, highest first; break ties alphabetically.
- R6. If there are fewer than n distinct words, return all of them.

## 6. Testing
Test with at least: an empty string, a string containing only punctuation, and a string where
several words have the same count.

## 7. Extension (optional)
Rewrite your solution using `collections.Counter` and compare the two versions.
"""

CODE_FILENAME = "word_counter.py"
CODE = '''import string


def top_words(text, n=3):
    """Return the n most common words in text, most frequent first."""
    counts = {}
    for raw in text.split():
        word = raw.strip(string.punctuation).lower()
        if not word:
            continue
        counts[word] = counts.get(word, 0) + 1

    ranked = sorted(counts.items(), key=lambda pair: (-pair[1], pair[0]))
    return ranked[:n]


if __name__ == "__main__":
    sample = "The cat sat. The cat ran! A dog sat, too."
    print(top_words(sample, 2))
'''


def _q(type_, topic, question, choices, explanation, source_kind, source_ref, lines=()):
    return {
        "type": type_, "topic": topic, "question": question, "choices": choices, "correct_index": 0,
        "explanation": explanation, "source_kind": source_kind, "source_ref": source_ref,
        "code_file": CODE_FILENAME if source_kind == "code" else None,
        "code_lines": [{"start": a, "end": b} for a, b in lines],
    }


QUIZ = {
    "title": "Lab 4: Word Frequencies",
    "questions": [
        _q("conceptual", "Dictionary counting",
           "Why does the lab manual recommend `dict.get(key, default)` when counting?",
           ["It returns the default instead of raising a `KeyError` the first time an item is seen",
            "It keeps the dictionary sorted while you count",
            "It makes lookups faster than indexing with `counts[key]`",
            "It removes duplicate keys from the dictionary"],
           "With a default, a missing key gives 0 instead of a `KeyError`. It doesn't sort anything, and it isn't faster than indexing.",
           "manual", "2. Background: counting with dictionaries"),
        _q("conceptual", "Sorting with a key",
           "According to the manual, how does Python compare the tuples `(-2, 'cat')` and `(-2, 'sat')`?",
           ["First elements first; because they're equal, the second elements decide",
            "By the number of elements in each tuple",
            "By the last element first, then the first",
            "It can't: comparing tuples raises a `TypeError`"],
           "Tuples compare element by element, so the tie on -2 is broken by 'cat' < 'sat'.",
           "manual", "3. Background: sorting with a key"),
        _q("conceptual", "Time complexity",
           "Counting n words with a dictionary and then sorting the m distinct words: what total running time does the manual's reasoning give?",
           ["O(n + m log m)", "O(n²)", "O(n × m)", "O(log n)"],
           "Counting is O(n) (constant-time dictionary updates) and sorting m items is O(m log m); the two steps happen one after the other, so the costs add.",
           "manual", "2. Background / 3. Background"),
        _q("code_reading", "Returning the top n",
           "Which line meets requirement R6 (return all words when there are fewer than n distinct ones), and why?",
           ["Line 14: slicing past the end of a list returns the whole list without an error",
            "Line 13: `sorted()` stops once it has n items",
            "Line 9: empty words are skipped before counting",
            "Line 4: `n=3` makes 3 the maximum number of results"],
           "`ranked[:n]` never raises when n is larger than the list. It just returns everything. `sorted()` always sorts the whole list.",
           "code", "top_words", [(14, 14)]),
        _q("code_reading", "Dictionary counting",
           "On line 11, what does `counts.get(word, 0) + 1` evaluate to the first time a word appears?",
           ["1", "0", "None", "It raises a `KeyError`"],
           "`.get` returns the default 0 for a new word, and adding 1 gives 1. A `KeyError` would only happen with `counts[word]`.",
           "code", "top_words", [(11, 11)]),
        _q("code_reading", "Normalising words",
           "What does line 8 turn the token `\"Sat,\"` into?",
           ["`'sat'`", "`'Sat'`", "`'sat,'`", "`''`"],
           "`strip(string.punctuation)` removes the trailing comma and `.lower()` lower-cases it. Only punctuation-only tokens become `''`.",
           "code", "top_words", [(8, 8)]),
        _q("code_reading", "Sorting with a key",
           "Why does the key on line 13 use `-pair[1]` rather than `pair[1]`?",
           ["`sorted()` is ascending, so negating the counts puts the highest counts first",
            "To filter out words with negative counts",
            "Because `pair[1]` is a string that has to be converted to a number",
            "To sort the words in reverse alphabetical order"],
           "Ascending order on -count is descending order on count, which is requirement R5. The word itself (`pair[0]`) still sorts A to Z.",
           "code", "top_words", [(13, 13)]),
        _q("code_reading", "Tie-breaking",
           "Reading the code (not running it), what would `top_words(\"b a a b c\", 2)` return?",
           ["`[('a', 2), ('b', 2)]`", "`[('b', 2), ('a', 2)]`", "`[('a', 2), ('b', 2), ('c', 1)]`", "`[('c', 1), ('a', 2)]`"],
           "'a' and 'b' both appear twice, so the tie is broken alphabetically by `pair[0]`; `[:2]` keeps two pairs.",
           "code", "top_words", [(13, 14)]),
        _q("debugging", "Normalising words",
           "Hypothetically, if lines 9–10 were deleted, which requirement would break, and for what input?",
           ["R4: a token like `--` would be counted as the empty word `''`",
            "R2: 'The' and 'the' would be counted as different words",
            "R5: ties would no longer be broken alphabetically",
            "R1: the text would no longer be split on whitespace"],
           "Line 8 turns a punctuation-only token into `''`; lines 9–10 are what stop it being counted. Case and sorting are handled elsewhere.",
           "code", "top_words", [(8, 10)]),
        _q("debugging", "Normalising words",
           "Hypothetically, if line 8 used `raw.lower()` without `.strip(string.punctuation)`, what would happen with the sample sentence on line 18?",
           ["`'sat.'` and `'sat,'` would be counted as two different words, breaking R3",
            "The program would crash with a `TypeError`",
            "'The' and 'the' would be counted separately",
            "Nothing would change, because `split()` already removes punctuation"],
           "`split()` only splits on whitespace, so punctuation stays attached. Without `strip`, 'sat.' and 'sat,' are different keys. Lower-casing still happens, so case isn't the problem.",
           "code", "top_words", [(8, 8), (18, 18)]),
    ],
}
