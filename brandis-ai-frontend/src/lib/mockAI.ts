import { SuggestedKeyword } from '@/types/canvas';

type TopicEntry = {
  pattern: RegExp;
  response: string;
  keywords: string[];
};

const topics: TopicEntry[] = [
  // --- Core language concepts ---
  {
    pattern: /what is java|learn java|getting started.*java|java.*beginner|java.*language/i,
    response:
      "Java is an object-oriented programming language designed to be platform-independent. Code is compiled into bytecode that runs on the Java Virtual Machine (JVM), which means the same program can run on Windows, Mac, or Linux without changes. Java uses strong static typing, meaning every variable must have a declared data type. Programs are organized into classes, and execution starts from a special method called the main method.",
    keywords: ["object-oriented", "bytecode", "Java Virtual Machine", "static typing", "data type", "classes", "main method"],
  },
  {
    pattern: /object.oriented|OOP/i,
    response:
      "Object-oriented programming (OOP) is a paradigm where you model your code around objects rather than actions. In Java, everything lives inside a class. The four pillars of OOP are encapsulation (bundling data with the methods that operate on it), inheritance (creating new classes from existing ones), polymorphism (one interface, many implementations), and abstraction (hiding complex details behind simple interfaces). Objects are instances of classes, created using the new keyword and constructors.",
    keywords: ["class", "encapsulation", "inheritance", "polymorphism", "abstraction", "instances", "constructors"],
  },
  {
    pattern: /class(es)?[\s\b]|what.*class/i,
    response:
      "A class in Java is a blueprint for creating objects. It defines fields (variables that hold data) and methods (functions that define behavior). For example, a Car class might have fields like color and speed, and methods like accelerate() and brake(). Classes can have access modifiers like public, private, and protected that control visibility. You can also define static members that belong to the class itself rather than to any specific instance.",
    keywords: ["objects", "fields", "methods", "access modifiers", "public", "private", "static"],
  },
  {
    pattern: /inheritance|extends|superclass|subclass/i,
    response:
      "Inheritance lets a class (the subclass) inherit fields and methods from another class (the superclass) using the extends keyword. The subclass can reuse the parent's code and also override methods to provide its own behavior. Java supports single inheritance only — a class can extend just one parent — but you can achieve something similar to multiple inheritance using interfaces. Every class in Java implicitly extends the Object class, which provides methods like toString() and equals().",
    keywords: ["extends", "override", "interfaces", "Object class", "toString()", "equals()", "single inheritance"],
  },
  {
    pattern: /interface(s)?[\s\b]|implements/i,
    response:
      "An interface in Java defines a contract — a set of method signatures that a class must implement. Unlike a class, an interface cannot hold state (before Java 8). A class uses the implements keyword to adopt an interface, and it must provide concrete implementations of all declared methods. Since Java 8, interfaces can also contain default methods (with a body) and static methods. A class can implement multiple interfaces, which is how Java works around its single inheritance limitation.",
    keywords: ["method signatures", "implements", "default methods", "static methods", "single inheritance", "contract"],
  },
  {
    pattern: /encapsulation|getter|setter|private.*field/i,
    response:
      "Encapsulation is the practice of keeping a class's fields private and exposing access through public getter and setter methods. This protects the internal state of an object from being modified in unexpected ways. For example, a BankAccount class would keep its balance private and only allow changes through a deposit() method that validates the amount. This is closely tied to the principle of information hiding and helps maintain invariants — rules about what constitutes a valid state.",
    keywords: ["private", "getter", "setter", "information hiding", "invariants"],
  },
  {
    pattern: /polymorphism|overload|overrid/i,
    response:
      "Polymorphism means 'many forms' and in Java it comes in two flavors. Compile-time polymorphism (method overloading) is when multiple methods in the same class share a name but have different parameter lists. Runtime polymorphism (method overriding) is when a subclass provides its own version of a method defined in its superclass. The JVM decides which version to call at runtime based on the actual object type, not the reference type. This is what makes patterns like the Strategy pattern possible.",
    keywords: ["method overloading", "method overriding", "subclass", "superclass", "JVM", "Strategy pattern", "runtime"],
  },
  {
    pattern: /abstraction|abstract.*class/i,
    response:
      "Abstraction means exposing only the essential details while hiding the complexity. In Java, you can achieve this with abstract classes and interfaces. An abstract class is declared with the abstract keyword and can contain both regular methods (with bodies) and abstract methods (without bodies). You cannot instantiate an abstract class directly — you must create a subclass that implements all its abstract methods. Abstract classes are useful when related classes share some common behavior but differ in specifics.",
    keywords: ["abstract classes", "interfaces", "abstract keyword", "instantiate", "subclass"],
  },

  // --- Data types & variables ---
  {
    pattern: /data type|primitive|int\b|boolean|double|char\b|string\b/i,
    response:
      "Java has two categories of data types: primitives and reference types. The eight primitives are byte, short, int, long (for whole numbers), float, double (for decimals), char (for single characters), and boolean (true/false). Reference types include classes, arrays, and interfaces — they hold a memory address pointing to an object on the heap. String is technically a reference type but behaves specially because Java pools and internalizes string literals for performance.",
    keywords: ["primitives", "reference types", "arrays", "heap", "String", "memory address"],
  },
  {
    pattern: /variable|declaration|assign/i,
    response:
      "In Java, every variable must be declared with a specific data type before use. A declaration looks like: int count; and an assignment gives it a value: count = 10; You can combine them: int count = 10; Variables declared inside a method are called local variables and must be initialized before use. Variables declared in a class (outside methods) are called fields or instance variables and get default values (0 for numbers, null for objects, false for booleans).",
    keywords: ["data type", "local variables", "fields", "instance variables", "default values", "null"],
  },

  // --- Methods & control flow ---
  {
    pattern: /method(s)?[\s\b]|function|void|return/i,
    response:
      "A method in Java is a block of code that performs a specific task. It has a return type (like int, String, or void if it returns nothing), a name, and optionally parameters. Methods promote code reuse — instead of writing the same logic multiple times, you write it once and call it wherever needed. Methods can be instance methods (called on an object) or static methods (called on the class itself). The method signature — its name plus parameter types — must be unique within a class.",
    keywords: ["return type", "parameters", "void", "code reuse", "instance methods", "static methods", "method signature"],
  },
  {
    pattern: /static[\s\b]|static method|static field/i,
    response:
      "The static keyword means something belongs to the class rather than to any particular object instance. A static field is shared across all instances — for example, a counter tracking how many objects have been created. A static method can be called without creating an object: Math.sqrt(16). Static methods cannot access instance fields or methods directly because they don't have a this reference. The main method is static because the JVM needs to call it before any objects exist.",
    keywords: ["class", "instance", "static field", "static method", "Math", "this reference", "main method"],
  },
  {
    pattern: /main method|public static void main/i,
    response:
      "The main method is the entry point of any Java application. Its signature is always: public static void main(String[] args). It's public so the JVM can access it from outside the class, static so it can be called without creating an object, and void because it doesn't return a value. The String[] args parameter lets you pass command-line arguments to your program. When you run java MyApp hello world, args[0] is \"hello\" and args[1] is \"world\".",
    keywords: ["entry point", "JVM", "public", "static", "void", "command-line arguments"],
  },
  {
    pattern: /loop|for\b|while\b|iteration/i,
    response:
      "Java has several loop constructs for repeating code. The for loop is best when you know how many iterations you need: for (int i = 0; i < 10; i++). The while loop repeats as long as a condition is true. The do-while loop runs at least once before checking the condition. Java also has the enhanced for loop (for-each) for iterating over arrays and collections: for (String name : names). You can control loops with break (exit immediately) and continue (skip to next iteration).",
    keywords: ["for loop", "while loop", "do-while", "for-each", "arrays", "collections", "break", "continue"],
  },
  {
    pattern: /if\b|else|conditional|switch|ternary/i,
    response:
      "Conditional statements let your program make decisions. The if statement executes a block only when a boolean expression is true. You can chain alternatives with else if and provide a fallback with else. The switch statement is useful when comparing a single value against many options — it works with int, char, String, and enum types. Java also has the ternary operator (condition ? valueIfTrue : valueIfFalse) for compact inline conditions.",
    keywords: ["boolean expression", "else if", "switch", "String", "enum", "ternary operator"],
  },

  // --- Collections & arrays ---
  {
    pattern: /array(s)?[\s\b]|arraylist|list\b/i,
    response:
      "An array in Java is a fixed-size container that holds elements of the same type: int[] numbers = new int[5]; Once created, its length cannot change. For dynamic sizing, Java provides the ArrayList class from the Collections Framework. ArrayList grows automatically as you add elements and provides methods like add(), get(), remove(), and size(). It uses generics to ensure type safety: ArrayList<String> names = new ArrayList<>(); Under the hood, ArrayList is backed by a regular array that gets resized when needed.",
    keywords: ["fixed-size", "ArrayList", "Collections Framework", "generics", "type safety"],
  },
  {
    pattern: /collection(s)?.*framework|hashmap|map\b|set\b|queue/i,
    response:
      "The Collections Framework is Java's built-in library for data structures. The main interfaces are List (ordered, allows duplicates), Set (no duplicates), Map (key-value pairs), and Queue (FIFO ordering). Common implementations include ArrayList and LinkedList for lists, HashSet and TreeSet for sets, and HashMap and TreeMap for maps. Choosing the right collection depends on your needs: HashMap gives O(1) lookups but no ordering, while TreeMap keeps keys sorted but has O(log n) lookups.",
    keywords: ["List", "Set", "Map", "Queue", "ArrayList", "HashMap", "TreeMap", "LinkedList", "data structures"],
  },
  {
    pattern: /generic(s)?[\s\b]|type parameter|<T>/i,
    response:
      "Generics allow you to write classes and methods that work with any type while keeping type safety at compile time. Instead of writing separate IntList, StringList, etc., you write one class: class Box<T> { T value; }. The type parameter T gets replaced with a real type when you use it: Box<String> box = new Box<>(); Generics prevent ClassCastException errors by catching type mismatches at compile time rather than runtime. You can also bound type parameters: <T extends Comparable<T>> to restrict which types are allowed.",
    keywords: ["type safety", "compile time", "type parameter", "ClassCastException", "runtime", "Comparable", "bounded types"],
  },

  // --- Exception handling ---
  {
    pattern: /exception|try.*catch|throw|error handling/i,
    response:
      "Exceptions are Java's mechanism for handling errors that occur during execution. When something goes wrong, an exception object is thrown and the normal flow is interrupted. You handle exceptions using try-catch blocks: the try block contains risky code, and the catch block handles specific exception types. The finally block runs regardless of whether an exception occurred — useful for cleanup like closing files. Java distinguishes between checked exceptions (must be caught or declared) and unchecked exceptions (RuntimeException subclasses, like NullPointerException).",
    keywords: ["try-catch", "finally", "checked exceptions", "unchecked exceptions", "RuntimeException", "NullPointerException", "thrown"],
  },

  // --- JVM & compilation ---
  {
    pattern: /jvm|java virtual machine|bytecode|compile|javac/i,
    response:
      "The Java Virtual Machine (JVM) is what makes Java platform-independent. When you compile Java source code with javac, it produces bytecode (.class files) rather than native machine code. The JVM then interprets or JIT-compiles this bytecode into native instructions for whatever operating system it's running on. The JVM also handles memory management through garbage collection, which automatically frees memory from objects that are no longer referenced. Different JVM implementations exist, but the most common is HotSpot from Oracle.",
    keywords: ["bytecode", "javac", "JIT-compiles", "native machine code", "garbage collection", "memory management", "HotSpot"],
  },

  // --- Memory & null ---
  {
    pattern: /memory|heap|stack|garbage collect/i,
    response:
      "Java manages memory in two main areas: the stack and the heap. The stack stores local variables and method call information — it's fast but limited in size. The heap stores objects created with the new keyword — it's larger but slower to access. When an object on the heap has no more references pointing to it, the garbage collector eventually reclaims that memory. Understanding this distinction helps explain why primitive variables hold actual values (on the stack) while reference variables hold memory addresses pointing to objects on the heap.",
    keywords: ["stack", "heap", "local variables", "new keyword", "garbage collector", "references", "primitive"],
  },
  {
    pattern: /null\b|nullpointer|optional/i,
    response:
      "In Java, null means a reference variable doesn't point to any object. Trying to call a method or access a field on a null reference throws a NullPointerException — one of the most common bugs in Java. To guard against this, you can check for null before accessing: if (obj != null). Java 8 introduced Optional<T> as a more expressive alternative — it wraps a value that might or might not be present, and provides methods like isPresent(), orElse(), and map() that force you to handle the absent case explicitly.",
    keywords: ["reference variable", "NullPointerException", "Optional", "isPresent()", "orElse()", "Java 8"],
  },
];

function findKeywordPositions(text: string, keywords: string[]): SuggestedKeyword[] {
  const found: SuggestedKeyword[] = [];
  for (const term of keywords) {
    const lowerText = text.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const index = lowerText.indexOf(lowerTerm);
    if (index === -1) continue;

    found.push({
      id: `kw-${index}-${term.replace(/\s+/g, '-')}`,
      term: text.substring(index, index + term.length),
      startIndex: index,
      endIndex: index + term.length,
      hex: '#f59e0b',
    });
  }
  return found.sort((a, b) => a.startIndex - b.startIndex);
}

const fallback = {
  response:
    "That's a great question! In Java, this concept connects to several foundational ideas in the language. Understanding how Java handles types, objects, and memory will help you build a clearer mental model. Try asking about something specific like classes, data types, methods, or the JVM to dive deeper.",
  keywords: ["classes", "data types", "methods", "JVM", "objects", "memory"],
};

export async function mockAIResponse(
  userMessage: string
): Promise<{ response: string; keywords: SuggestedKeyword[] }> {
  await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 600));

  const match = topics.find((t) => t.pattern.test(userMessage));
  const { response, keywords } = match ?? fallback;

  return {
    response,
    keywords: findKeywordPositions(response, keywords),
  };
}
