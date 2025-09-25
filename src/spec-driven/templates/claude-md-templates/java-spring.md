# CLAUDE.md - {{bounty_title}}

Java/Spring Boot project-specific AI assistant guidelines for spec-driven bounty implementation.

## Bounty Context & Mission

**Bounty**: {{bounty_title}} ({{bounty_id}})
**Reward**: {{bounty_amount}}
**Organization**: {{organization}}
**Repository**: {{repository}}
**Viability Assessment**: {{viability_category}} ({{viability_score}})
**Estimated Timeline**: {{time_estimate}}

**Mission Statement**: {{viability_reasoning}}

## Java Project Analysis

### Technology Stack
- **Language**: {{primary_language}} with {{frameworks}}
- **Build System**: {{build_tools}}
- **Testing**: {{testing_frameworks}}
- **Quality Tools**: {{linting_tools}}
- **Project Structure**: {{file_organization}}

### Application Architecture
- **Entry Points**:
{{entry_points}}

- **Test Directories**:
{{test_directories}}

## Spec-Driven Requirements (EARS Format)

### Primary Requirements
{{primary_requirements}}

### Acceptance Criteria (Must-Have)
{{acceptance_criteria}}

### System Constraints
{{constraints}}

### Working Assumptions
{{assumptions}}

## System Design & Architecture

**Technical Approach**: {{technical_approach}}

### Architecture Changes Required
{{architecture_changes}}

### Integration Points
{{integration_points}}

### Data Flow
{{data_flow}}

## Implementation Plan: Discrete Tasks

{{discrete_tasks}}

**Summary**: {{task_count}} total tasks ({{high_priority_tasks}} high priority)

## Java/Spring Boot Implementation Standards

### Code Quality Requirements
- **SOLID Principles**: Follow single responsibility and dependency inversion
- **Spring Conventions**: Use proper annotation-driven configuration
- **Exception Handling**: Comprehensive error handling with custom exceptions
- **Bean Management**: Proper dependency injection and lifecycle management
- **Data Access**: JPA/Hibernate best practices or jOOQ if preferred

### Spring Boot Best Practices
- **Auto-Configuration**: Leverage Spring Boot's auto-configuration
- **Configuration Properties**: Use @ConfigurationProperties for settings
- **Profiles**: Environment-specific configuration with profiles
- **Actuator**: Health checks and monitoring endpoints
- **Security**: Proper authentication and authorization patterns

### REST API Patterns
- **Controller Layer**: Clean REST controllers with proper HTTP semantics
- **Service Layer**: Business logic separation from web concerns
- **Repository Layer**: Data access abstraction with Spring Data
- **DTO Patterns**: Request/response objects with validation
- **Exception Handling**: Global exception handling with @ControllerAdvice

### Testing Strategy: {{test_strategy}}
- **Unit Tests**: JUnit 5 with Mockito for mocking
- **Integration Tests**: @SpringBootTest for full application context
- **Web Layer Tests**: @WebMvcTest for controller testing
- **Data Layer Tests**: @DataJpaTest for repository testing
- **Test Containers**: Database integration testing with TestContainers

### Build & Development Workflow
- **Maven/Gradle**: Proper dependency management and build plugins
- **Code Quality**: Checkstyle, SpotBugs, PMD for static analysis
- **Testing**: Surefire/Failsafe for test execution
- **Packaging**: Spring Boot executable JAR with embedded server
- **Documentation**: JavaDoc and OpenAPI/Swagger integration

## Java/Spring Boot Implementation Guidance

### Service Development Pattern
1. **Entity Design**: Create JPA entities with proper relationships
2. **Repository Interfaces**: Define Spring Data repository contracts
3. **Service Layer Tests**: Write service tests first (TDD)
4. **Service Implementation**: Implement business logic services
5. **Controller Layer**: Create REST controllers with validation
6. **Exception Handling**: Add global exception handling
7. **Integration Testing**: Test full request-response flow

### Common Spring Boot Patterns to Follow
```java
// REST Controller with validation
@RestController
@RequestMapping("/api/v1/items")
@Validated
public class ItemController {

    private final ItemService itemService;

    public ItemController(ItemService itemService) {
        this.itemService = itemService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ItemDto>> createItem(
            @Valid @RequestBody CreateItemRequest request) {
        try {
            ItemDto item = itemService.createItem(request);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(ApiResponse.success(item));
        } catch (ValidationException e) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error(e.getMessage()));
        }
    }
}

// Service layer with transaction management
@Service
@Transactional
public class ItemService {

    private final ItemRepository itemRepository;

    public ItemService(ItemRepository itemRepository) {
        this.itemRepository = itemRepository;
    }

    public ItemDto createItem(CreateItemRequest request) {
        validateRequest(request);

        Item item = Item.builder()
                .name(request.getName())
                .description(request.getDescription())
                .createdAt(LocalDateTime.now())
                .build();

        Item saved = itemRepository.save(item);
        return ItemMapper.toDto(saved);
    }
}
```

### Exception Handling Strategy
```java
// Custom exception hierarchy
public class BusinessException extends RuntimeException {
    private final String errorCode;

    public BusinessException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }
}

// Global exception handler
@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusinessException(BusinessException e) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(e.getErrorCode(), e.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidationException(
            MethodArgumentNotValidException e) {
        List<String> errors = e.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(DefaultMessageSourceResolvable::getDefaultMessage)
                .collect(Collectors.toList());

        return ResponseEntity.badRequest()
                .body(ApiResponse.error("VALIDATION_ERROR", String.join(", ", errors)));
    }
}
```

### Data Access Patterns
```java
// JPA Entity with proper annotations
@Entity
@Table(name = "items")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Item {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}

// Spring Data repository with custom queries
@Repository
public interface ItemRepository extends JpaRepository<Item, Long> {

    @Query("SELECT i FROM Item i WHERE i.name LIKE %:name% ORDER BY i.createdAt DESC")
    Page<Item> findByNameContaining(@Param("name") String name, Pageable pageable);

    @Modifying
    @Query("UPDATE Item i SET i.description = :description WHERE i.id = :id")
    int updateDescription(@Param("id") Long id, @Param("description") String description);
}
```

### Configuration Management
```java
// Configuration properties
@ConfigurationProperties(prefix = "app")
@Data
public class AppProperties {
    private String name;
    private String version;
    private Database database = new Database();

    @Data
    public static class Database {
        private int maxConnections = 10;
        private Duration connectionTimeout = Duration.ofSeconds(30);
    }
}

// Configuration class
@Configuration
@EnableConfigurationProperties(AppProperties.class)
public class ApplicationConfig {

    @Bean
    @ConditionalOnProperty(name = "app.cache.enabled", havingValue = "true")
    public CacheManager cacheManager() {
        return new ConcurrentMapCacheManager();
    }
}
```

## Risk Management & Success Criteria

### Risk Assessment
{{risk_assessment}}

### Success Indicators
{{success_indicators}}

### Potential Blockers
{{potential_blockers}}

### Java/Spring-Specific Risks
- **Circular Dependencies**: Careful bean dependency management
- **N+1 Query Problems**: Proper JPA fetch strategies
- **Memory Leaks**: Proper resource management and cleanup
- **Transaction Boundaries**: Appropriate @Transactional usage

## Context Management

### Critical Information (Always Prioritize)
1. Java compilation errors and classpath issues
2. Spring Boot configuration and auto-configuration
3. JPA/Hibernate query performance and lazy loading
4. REST endpoint mappings and HTTP semantics
5. Exception handling and error response formatting

### Secondary Information
1. Maven/Gradle build configuration
2. Database schema and migration scripts
3. Security configuration and authentication
4. Actuator health checks and monitoring

## Session Focus

### Primary Goal
Complete {{bounty_title}} following Java/Spring Boot best practices

### Quality Gates
- [ ] All code compiles without warnings
- [ ] Spring Boot application starts successfully
- [ ] All tests pass with good coverage (>80%)
- [ ] REST endpoints follow proper HTTP semantics
- [ ] Database operations are properly transactional
- [ ] Exception handling provides meaningful responses
- [ ] Configuration is externalized and documented

### Java/Spring-Specific Validation
- [ ] No circular dependency issues
- [ ] Proper dependency injection patterns
- [ ] Database queries are optimized
- [ ] Security annotations are correctly applied
- [ ] Bean lifecycle is properly managed

---

**Generated**: {{generated_date}}
**Methodology**: Spec-driven development for Java/Spring Boot projects
**Pipeline**: claude-code-bounty-pipe