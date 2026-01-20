# Contributing to Legacy Vault

Thank you for your interest in contributing to Legacy Vault! This document provides guidelines for contributing to the project.

---

## Ways to Contribute

### Code Contributions
- Bug fixes
- New features
- Performance improvements
- Test coverage

### Non-Code Contributions
- Documentation improvements
- Translation to other languages
- Bug reports
- Feature suggestions
- Security research

---

## Getting Started

### Prerequisites

- Node.js 18+
- Git
- Massa wallet (for testing)
- Basic understanding of AssemblyScript (for contract work)

### Setup

```bash
# Fork the repository on GitHub

# Clone your fork
git clone https://github.com/YOUR_USERNAME/legacy-vault.git
cd legacy-vault

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/legacy-vault.git

# Install dependencies
npm install

# Build contracts
cd contracts && npm run build

# Run tests
npm test
```

---

## Development Workflow

### Branch Naming

- `feature/description` — New features
- `fix/description` — Bug fixes
- `docs/description` — Documentation
- `refactor/description` — Code refactoring

### Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `test` — Tests
- `refactor` — Code refactoring
- `chore` — Maintenance

Examples:
```
feat(vault): add multi-heir percentage validation
fix(frontend): resolve wallet connection on mobile
docs(readme): update deployment instructions
```

### Pull Request Process

1. **Create feature branch** from `main`
2. **Make changes** with clear commits
3. **Write/update tests** for your changes
4. **Update documentation** if needed
5. **Run tests** locally: `npm test`
6. **Open PR** with clear description
7. **Address review feedback**
8. **Squash and merge** when approved

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How did you test these changes?

## Checklist
- [ ] My code follows the project style
- [ ] I have added tests
- [ ] I have updated documentation
- [ ] All tests pass locally
```

---

## Code Style

### AssemblyScript (Contracts)

```typescript
// Use descriptive names
function calculateInheritanceShare(vaultId: string, heirAddress: Address): u64

// Document public functions
/**
 * Calculates the inheritance share for a specific heir
 * @param vaultId - The vault identifier
 * @param heirAddress - The heir's address
 * @returns Share amount in nanoMAS
 */

// Use explicit types
const balance: u64 = getBalance();

// Constants in UPPER_SNAKE_CASE
const MAX_HEIRS: u8 = 10;
const MIN_INTERVAL_MS: u64 = 7 * 24 * 60 * 60 * 1000;
```

### TypeScript (Frontend)

```typescript
// Use functional components
const VaultCard: React.FC<VaultCardProps> = ({ vault }) => {
  // ...
};

// Use hooks for state
const [isLoading, setIsLoading] = useState(false);

// Destructure props
const { vault, onCheckIn } = props;

// Use async/await
const handleCheckIn = async () => {
  try {
    await checkIn(vaultId);
  } catch (error) {
    console.error('Check-in failed:', error);
  }
};
```

### General Guidelines

- Keep functions small and focused
- Write self-documenting code
- Add comments for complex logic
- No magic numbers — use named constants
- Handle errors gracefully

---

## Testing

### Contract Tests

```bash
cd contracts
npm test
```

Write tests for:
- All public functions
- Edge cases
- Access control
- Error conditions

### Frontend Tests

```bash
cd frontend
npm test
```

Focus on:
- Component rendering
- User interactions
- Wallet integration mocks
- Error states

---

## Areas We Need Help

### High Priority
- [ ] Smart contract security review
- [ ] Unit test coverage improvement
- [ ] Mobile responsiveness
- [ ] Accessibility (a11y)

### Medium Priority
- [ ] Documentation translations
- [ ] Performance optimization
- [ ] Error message improvements
- [ ] UI/UX enhancements

### Good First Issues

Look for issues labeled `good first issue` — these are suitable for newcomers.

---

## Communication

- **GitHub Issues** — Bug reports, feature requests
- **GitHub Discussions** — Questions, ideas
- **Discord** — Real-time chat (link in README)

---

## Code of Conduct

### Our Standards

- Be respectful and inclusive
- Accept constructive criticism
- Focus on what's best for the project
- Show empathy towards others

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Publishing others' private information
- Other unprofessional conduct

Violations may result in being banned from the project.

---

## Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- Special thanks in documentation

---

## Questions?

Feel free to open a GitHub Discussion or reach out on Discord.

Thank you for contributing to Legacy Vault! 🙏
