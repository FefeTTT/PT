import type { z } from 'zod';
import type { ValidationIssueDTO } from '../dtos';

export interface ParseResult<T> {
    data?: T;
    issues: ValidationIssueDTO[];
}

export function parseWithIssues<T>(
    schema: z.ZodType<T>,
    input: unknown,
    label: string
): ParseResult<T> {
    const result = schema.safeParse(input);

    if (result.success) {
        return { data: result.data, issues: [] };
    }

    return {
        issues: result.error.issues.map((issue) => ({
            path: issue.path.length > 0 ? `${label}.${issue.path.join('.')}` : label,
            message: issue.message,
            severity: 'error',
        })),
    };
}

export function warning(path: string, message: string): ValidationIssueDTO {
    return { path, message, severity: 'warning' };
}

export function error(path: string, message: string): ValidationIssueDTO {
    return { path, message, severity: 'error' };
}
