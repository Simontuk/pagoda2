all: p2pack.o
	g++ -o p2pack -std=c++11 p2pack.o  -lboost_program_options -lboost_filesystem -lboost_system -lboost_regex
	chmod u+x p2pack
p2pack.o: p2pack.cpp p2pack.h
	g++ -std=c++11 -I . -c p2pack.cpp
clean:
	-rm *.o
	-rm p2pack
