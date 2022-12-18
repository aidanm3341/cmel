package com.aidan.aph;

public enum TokenType {
    // single char tokens
    LEFT_PAREN, RIGHT_PAREN, LEFT_BRACE, RIGHT_BRACE,
    COMMA, DOT, PLUS, MINUS, SEMICOLON, SLASH, STAR,
    QUESTION, COLON,

    // one or two chars
    BANG, BANG_EQUAL,
    EQUAL, EQUAL_EQUAL,
    GREATER, GREATER_EQUAL,
    LESS, LESS_EQUAL,

    // literals
    IDENTIFIER, STRING, NUMBER,

    // keywords
    AND, OR, CLASS, FUN, IF, ELSE, FOR, FALSE, TRUE, NIL,
    RETURN, SUPER, THIS, VAR, WHILE,

    EOF
}
