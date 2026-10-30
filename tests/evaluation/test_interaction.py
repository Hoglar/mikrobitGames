"""Regression coverage for real input validation, cancellation and retained answers."""
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from interaction import prompt_review, prompt_session


class SessionInputTests(unittest.TestCase):
    def test_missing_required_context_retries_and_preserves_optional_context(self):
        with patch('builtins.input', side_effect=[' ', '01 – baseline', '', 'Gruppen', 'USB på Windows']), patch('builtins.print'):
            self.assertEqual(prompt_session(), {'label': '01 – baseline', 'reviewer': 'Gruppen', 'context': 'USB på Windows'})

    def test_supplied_label_does_not_prompt_again(self):
        with patch('builtins.input', side_effect=['Gruppen', '']), patch('builtins.print'):
            result = prompt_session('  Baseline  ')
        self.assertEqual(result, {'label': 'Baseline', 'reviewer': 'Gruppen', 'context': ''})

    def test_session_cancel_propagates_before_tests_start(self):
        for error in (EOFError, KeyboardInterrupt):
            with self.subTest(error=error), patch('builtins.input', side_effect=error), patch('builtins.print'):
                with self.assertRaises(error):
                    prompt_session()


class ReviewInputTests(unittest.TestCase):
    def test_complete_review_asks_exactly_two_questions(self):
        with patch('builtins.input', side_effect=['Lett å finne frem, men pause var uklar.', '8']) as answers, patch('builtins.print'):
            review = prompt_review('Gruppen')
        self.assertEqual(answers.call_count, 2)
        self.assertIn('Hvordan var brukeropplevelsen?', answers.call_args_list[0].args[0])
        self.assertIn('(1–10)', answers.call_args_list[1].args[0])
        self.assertEqual(review, dict(status='complete', reviewer='Gruppen',
                                     comment='Lett å finne frem, men pause var uklar.', score=8))

    def test_no_reviewer_argument_does_not_add_a_third_question(self):
        with patch('builtins.input', side_effect=['Enkelt å spille.', '7,5']) as answers, patch('builtins.print'):
            review = prompt_review()
        self.assertEqual(answers.call_count, 2)
        self.assertEqual(review['status'], 'complete')
        self.assertEqual(review['score'], 7.5)
        self.assertEqual(review['reviewer'], 'Ikke oppgitt')

    def test_score_rejects_nonfinite_out_of_range_and_invalid_values(self):
        answers = ['Tydelig pausevisning.', 'nan', 'inf', '-1', '0', '0,9', '11', 'tekst', '1']
        with patch('builtins.input', side_effect=answers), patch('builtins.print'):
            review = prompt_review('Gruppen')
        self.assertEqual(review['status'], 'complete')
        self.assertEqual(review['score'], 1)

    def test_required_overall_answers_retry(self):
        answers = ['', '  ', 'Pause var vanskelig å finne.', '10']
        with patch('builtins.input', side_effect=answers), patch('builtins.print'):
            review = prompt_review('Gruppen')
        self.assertEqual(review['comment'], 'Pause var vanskelig å finne.')
        self.assertEqual(review['score'], 10)

    def test_deferral_retains_comment_without_inventing_score(self):
        with patch('builtins.input', side_effect=['Kontrollene var uklare.', 'senere']), patch('builtins.print'):
            review = prompt_review('Gruppen')
        self.assertEqual(review['status'], 'deferred')
        self.assertEqual(review['comment'], 'Kontrollene var uklare.')
        self.assertNotIn('score', review)

    def test_blank_score_defers_with_comment_preserved(self):
        answers = ['Lett å starte.', '']
        with patch('builtins.input', side_effect=answers), patch('builtins.print'):
            review = prompt_review('Gruppen')
        self.assertEqual(review['status'], 'deferred')
        self.assertEqual(review['comment'], 'Lett å starte.')
        self.assertNotIn('score', review)

    def test_eof_and_interrupt_retain_completed_answers(self):
        for error in (EOFError, KeyboardInterrupt):
            with self.subTest(error=error), patch('builtins.input', side_effect=['Tydelig start', error]), patch('builtins.print'):
                review = prompt_review('Gruppen')
            self.assertEqual(review['status'], 'interrupted')
            self.assertEqual(review['comment'], 'Tydelig start')
            self.assertNotIn('score', review)


if __name__ == '__main__':
    unittest.main()
