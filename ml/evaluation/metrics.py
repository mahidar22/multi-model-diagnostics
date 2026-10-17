from __future__ import annotations

from typing import Sequence


def classification_metrics(y_true: Sequence[str], y_pred: Sequence[str], labels: Sequence[str]) -> dict:
    if len(y_true) != len(y_pred):
        raise ValueError("y_true and y_pred must have the same number of entries")
    if not labels:
        raise ValueError("At least one label is required")
    label_to_index = {label: index for index, label in enumerate(labels)}
    matrix = [[0 for _ in labels] for _ in labels]

    for truth, prediction in zip(y_true, y_pred):
        if truth not in label_to_index or prediction not in label_to_index:
            raise ValueError("Encountered a class not present in the declared label order")
        matrix[label_to_index[truth]][label_to_index[prediction]] += 1

    per_class = []
    f1_values = []
    for index, label in enumerate(labels):
        true_positive = matrix[index][index]
        false_positive = sum(matrix[row][index] for row in range(len(labels)) if row != index)
        false_negative = sum(matrix[index][column] for column in range(len(labels)) if column != index)
        support = sum(matrix[index])
        precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else 0.0
        recall = true_positive / (true_positive + false_negative) if true_positive + false_negative else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        f1_values.append(f1)
        per_class.append({
            "label": label,
            "precision": round(precision, 6),
            "recall": round(recall, 6),
            "f1": round(f1, 6),
            "support": support,
        })

    return {
        "labels": list(labels),
        "confusion_matrix": matrix,
        "per_class": per_class,
        "macro_f1": round(sum(f1_values) / len(f1_values), 6),
        "sample_count": len(y_true),
    }
