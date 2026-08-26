with open('backend/src/main/java/com/investa/model/InvestmentPolicy.java', 'r') as f:
    content = f.read()

content = content.replace('@Convert(converter = com.investa.util.AesEncryptor.class)\n    private String displayCurrencyPref;\n\n    private String geminiApiKey;', 'private String displayCurrencyPref;\n\n    @Convert(converter = com.investa.util.AesEncryptor.class)\n    private String geminiApiKey;')

with open('backend/src/main/java/com/investa/model/InvestmentPolicy.java', 'w') as f:
    f.write(content)
